import { prisma } from "@dochat/db";
import { eventBus } from "@/lib/event-bus";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { kbApi, indexingApi } from "@/lib/digitalocean";
import type { DoKbDatasource } from "@/lib/digitalocean";

export type KbDatasource = DoKbDatasource;

/**
 * Build a KbDatasource object from a source's properties.
 * Spaces takes precedence over legacy file_upload_data_source.
 */
export function buildDatasource(source: {
  sourceType: string;
  sourceUrl: string | null;
  storedObjectKey: string | null;
  spacesObjectKey: string | null;
  fileName: string | null;
  fileSize: number | null;
}): KbDatasource | null {
  if (source.sourceType === "website" && source.sourceUrl) {
    return {
      web_crawler_data_source: {
        base_url: source.sourceUrl,
        crawling_option: "SCOPED",
        embed_media: true,
      },
    };
  }
  if (source.spacesObjectKey) {
    return {
      spaces_data_source: {
        bucket_name: process.env.SPACES_BUCKET || "dochat",
        item_path: source.spacesObjectKey,
        region: process.env.SPACES_REGION || "sgp1",
      },
    };
  }
  if (source.storedObjectKey && source.fileName) {
    return {
      file_upload_data_source: {
        original_file_name: source.fileName,
        size_in_bytes: String(source.fileSize || 0),
        stored_object_key: source.storedObjectKey,
      },
    };
  }
  return null;
}

// ─── Spaces upload ───────────────────────────────────

function getSpacesClient(): S3Client {
  const region = process.env.SPACES_REGION || "sgp1";
  const accessKeyId = process.env.SPACES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY must be configured");
  }
  return new S3Client({
    endpoint: `https://${region}.digitaloceanspaces.com`,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

const MIME_TO_EXT: Record<string, string> = {
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/html": ".html",
  "text/markdown": ".md",
  "text/xml": ".xml",
  "application/pdf": ".pdf",
  "application/json": ".json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/rtf": ".rtf",
  "application/epub+zip": ".epub",
};

/**
 * Upload a file to DO Spaces bucket for use as spaces_data_source.
 * Returns the item_path (object key within the bucket).
 */
export async function uploadToSpaces(
  fileName: string,
  fileBuffer: ArrayBuffer,
  kbId: string,
  mimeType?: string,
): Promise<string> {
  const bucket = process.env.SPACES_BUCKET || "dochat";
  let safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const hasExtension = /\.[a-zA-Z0-9]{1,10}$/.test(safeFileName);
  if (!hasExtension) {
    const ext = (mimeType && MIME_TO_EXT[mimeType]) || ".txt";
    safeFileName = `${safeFileName}${ext}`;
  }

  const contentType = mimeType || "application/octet-stream";
  const itemPath = `kb-sources/${kbId}/${Date.now()}-${safeFileName}`;

  const s3 = getSpacesClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: itemPath,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType,
    }),
  );

  return itemPath;
}

// ─── KB folder lifecycle ──────────────────────────────

/**
 * Create a DO Knowledge Base for a KB folder with all its current sources.
 * Runs in the background (fire-and-forget from source add handler).
 */
export async function createKnowledgeBaseKb(
  orgId: string,
  kbId: string,
): Promise<void> {
  const kb = await prisma.knowledgeBase.findUniqueOrThrow({
    where: { id: kbId },
    include: { sources: true },
  });

  const datasources = kb.sources
    .map(buildDatasource)
    .filter((ds): ds is KbDatasource => ds !== null);

  if (datasources.length === 0) {
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { indexingStatus: "failed" },
    });
    console.error(`[createKnowledgeBaseKb] No indexable datasources for KB ${kbId}`);
    return;
  }

  try {
    // 1. Mark as "creating"
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { indexingStatus: "creating" },
    });
    eventBus.emit(orgId, { type: "kb:status", id: kbId, status: "creating" });

    // 2. Resolve OpenSearch database ID for this org
    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    const plan = sub?.plan ?? "free";
    const isFree = plan === "free";
    let databaseId: string | undefined;

    if (isFree) {
      databaseId = process.env.DO_FREE_OPENSEARCH_DB_ID;
      if (!databaseId) throw new Error("DO_FREE_OPENSEARCH_DB_ID not configured");
    } else {
      databaseId = sub?.openSearchDatabaseId || undefined;
    }

    // 3. Create DO KB
    const embeddingModel = process.env.DO_EMBEDDING_MODEL_UUID;
    if (!embeddingModel) throw new Error("DO_EMBEDDING_MODEL_UUID not configured");

    const safeName = kb.name
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 60);

    const buildKbBody = (dbId?: string) => {
      const body: Record<string, unknown> = {
        name: `${safeName}-kb`,
        embedding_model_uuid: embeddingModel,
        region: process.env.DO_AGENT_REGION || "tor1",
        project_id: process.env.DO_PROJECT_ID,
        datasources,
      };
      if (dbId) body.database_id = dbId;
      return body;
    };

    let kbData;
    try {
      kbData = await kbApi.createKnowledgeBase(buildKbBody(databaseId) as any);
    } catch (err: any) {
      // If creation failed with a stored database_id (paid plans only), the DB
      // may have been deleted on DO. Retry without it.
      if (databaseId && !isFree) {
        console.warn(`[createKnowledgeBaseKb] KB creation failed with database_id: ${err.message} — retrying without`);
        await prisma.subscription.update({
          where: { orgId },
          data: { openSearchDatabaseId: null },
        });
        databaseId = undefined;
        kbData = await kbApi.createKnowledgeBase(buildKbBody() as any);
      } else {
        throw err;
      }
    }

    const kbUuid = kbData.knowledge_base?.uuid;
    if (!kbUuid) throw new Error("No UUID returned from KB creation");

    const returnedDbId = kbData.knowledge_base?.database_id;

    // Fetch datasource UUIDs (not returned in creation response)
    const datasourceRecords = await kbApi.listDataSources(kbUuid);
    const datasourceUuids = datasourceRecords.map((ds) => ds.uuid);

    // 5. Save KB UUID + datasource UUIDs
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        gradientKbUuid: kbUuid,
        indexingStatus: "indexing",
      },
    });

    for (let i = 0; i < kb.sources.length && i < datasourceUuids.length; i++) {
      const source = kb.sources[i]!;
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: {
          gradientDatasourceUuid: datasourceUuids[i],
          indexingStatus: "indexing",
        },
      });
      eventBus.emit(orgId, { type: "kb:source:status", id: source.id, status: "indexing", kbId });
    }

    eventBus.emit(orgId, { type: "kb:status", id: kbId, status: "indexing" });

    // 6. Save DB ID for paid plans
    if (!isFree && !databaseId && returnedDbId) {
      await prisma.subscription.upsert({
        where: { orgId },
        update: { openSearchDatabaseId: returnedDbId },
        create: { orgId, openSearchDatabaseId: returnedDbId },
      });
    }

    // 7. Wait for KB DB provisioning + trigger indexing
    if (datasourceUuids.length > 0) {
      await waitForKbReadyAndIndex(kbUuid, datasourceUuids);
    }

    // 8. Wait for indexing to complete
    const indexResult = await waitForKbIndexingComplete(kbUuid);

    if (indexResult === "failed") {
      await prisma.knowledgeSource.updateMany({
        where: { knowledgeBaseId: kbId },
        data: { indexingStatus: "failed" },
      });
      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: { indexingStatus: "failed" },
      });
      for (const source of kb.sources) {
        eventBus.emit(orgId, { type: "kb:source:status", id: source.id, status: "failed", kbId });
      }
      eventBus.emit(orgId, { type: "kb:status", id: kbId, status: "failed" });
      console.error(`[createKnowledgeBaseKb] KB ${kbId} (DO: ${kbUuid}) indexing failed`);
      return;
    }

    if (indexResult === "timeout") {
      console.warn(`[createKnowledgeBaseKb] KB ${kbId} (DO: ${kbUuid}) indexing timed out, status remains indexing`);
      return;
    }

    // 9. Mark all sources and KB as "ready"
    await prisma.knowledgeSource.updateMany({
      where: { knowledgeBaseId: kbId },
      data: { indexingStatus: "ready" },
    });
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { indexingStatus: "ready" },
    });
    for (const source of kb.sources) {
      eventBus.emit(orgId, { type: "kb:source:status", id: source.id, status: "ready", kbId });
    }
    eventBus.emit(orgId, { type: "kb:status", id: kbId, status: "ready" });

    console.log(`[createKnowledgeBaseKb] KB ${kbId} (DO: ${kbUuid}) is ready`);
  } catch (err) {
    console.error(`[createKnowledgeBaseKb] Failed for KB ${kbId}:`, err);
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { indexingStatus: "failed" },
    }).catch(() => {});
    await prisma.knowledgeSource.updateMany({
      where: { knowledgeBaseId: kbId },
      data: { indexingStatus: "failed" },
    }).catch(() => {});
    eventBus.emit(orgId, { type: "kb:status", id: kbId, status: "failed" });
  }
}

/**
 * Add a single datasource to an existing DO KB.
 * If the KB has no gradientKbUuid yet, creates the KB first.
 */
export async function addSourceToKb(
  orgId: string,
  kbId: string,
  sourceId: string,
): Promise<void> {
  const kb = await prisma.knowledgeBase.findUniqueOrThrow({ where: { id: kbId } });
  const source = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });

  if (!kb.gradientKbUuid) {
    await createKnowledgeBaseKb(orgId, kbId);
    return;
  }

  const datasource = buildDatasource(source);
  if (!datasource) {
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { indexingStatus: "failed" },
    });
    console.error(`[addSourceToKb] No indexable datasource for source ${sourceId}`);
    return;
  }

  try {
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { indexingStatus: "indexing" },
    });
    eventBus.emit(orgId, { type: "kb:source:status", id: sourceId, status: "indexing", kbId });
    await updateKbStatus(orgId, kbId);

    // Add datasource to existing KB
    const dsData = await kbApi.addDataSource(kb.gradientKbUuid, datasource);
    const datasourceUuid = dsData.knowledge_base_data_source?.uuid;

    if (datasourceUuid) {
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { gradientDatasourceUuid: datasourceUuid },
      });

      await waitForKbReadyAndIndex(kb.gradientKbUuid, [datasourceUuid]);
    }

    const indexResult = await waitForKbIndexingComplete(kb.gradientKbUuid);

    if (indexResult === "succeeded") {
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { indexingStatus: "ready" },
      });
      eventBus.emit(orgId, { type: "kb:source:status", id: sourceId, status: "ready", kbId });
      console.log(`[addSourceToKb] Source ${sourceId} added to KB ${kbId}`);
    } else if (indexResult === "failed") {
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { indexingStatus: "failed" },
      });
      eventBus.emit(orgId, { type: "kb:source:status", id: sourceId, status: "failed", kbId });
      console.error(`[addSourceToKb] Source ${sourceId} indexing failed`);
    } else {
      console.warn(`[addSourceToKb] Source ${sourceId} indexing timed out, status remains indexing`);
    }
    await updateKbStatus(orgId, kbId);
  } catch (err) {
    console.error(`[addSourceToKb] Failed for source ${sourceId}:`, err);
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { indexingStatus: "failed" },
    }).catch(() => {});
    eventBus.emit(orgId, { type: "kb:source:status", id: sourceId, status: "failed", kbId });
    await updateKbStatus(orgId, kbId);
  }
}

/**
 * Remove a datasource from a DO KB.
 */
export async function removeSourceFromKb(
  kbUuid: string,
  datasourceUuid: string,
): Promise<void> {
  await kbApi.deleteDataSource(kbUuid, datasourceUuid);
}

/**
 * Recompute and update KB indexingStatus based on its sources.
 */
async function updateKbStatus(orgId: string, kbId: string): Promise<void> {
  const sources = await prisma.knowledgeSource.findMany({
    where: { knowledgeBaseId: kbId },
    select: { indexingStatus: true },
  });

  let status: string;
  if (sources.length === 0) {
    status = "pending";
  } else if (sources.some((s) => s.indexingStatus === "failed")) {
    status = "failed";
  } else if (sources.some((s) => ["pending", "creating", "indexing"].includes(s.indexingStatus))) {
    status = "indexing";
  } else {
    status = "ready";
  }

  await prisma.knowledgeBase.update({
    where: { id: kbId },
    data: { indexingStatus: status },
  });
  eventBus.emit(orgId, { type: "kb:status", id: kbId, status });
}

// ─── Indexing helpers ────────────────────────────────────

/**
 * Trigger an indexing job for specific data sources in a KB.
 */
export async function triggerIndexing(
  kbUuid: string,
  dataSourceUuids: string[],
): Promise<void> {
  await indexingApi.createIndexingJob(kbUuid, dataSourceUuids);
}

/**
 * Wait for a KB's internal database to be provisioned, then trigger indexing.
 */
async function waitForKbReadyAndIndex(
  kbUuid: string,
  datasourceUuids: string[],
  maxAttempts = 120,
  intervalMs = 5000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await triggerIndexing(kbUuid, datasourceUuids);
      console.log(`[waitForKbReadyAndIndex] KB ${kbUuid} ready after ${i * intervalMs / 1000}s`);
      return;
    } catch {
      // KB DB still provisioning — retry
    }

    if (i % 12 === 0) {
      console.log(`[waitForKbReadyAndIndex] Waiting for KB DB... attempt=${i + 1}/${maxAttempts}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.warn(`[waitForKbReadyAndIndex] KB ${kbUuid} did not become ready — proceeding anyway`);
}

/**
 * Wait for all indexing jobs on a KB to complete.
 */
async function waitForKbIndexingComplete(
  kbUuid: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<"succeeded" | "failed" | "timeout"> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const data = await kbApi.getKnowledgeBase(kbUuid);
      const job = data.knowledge_base?.last_indexing_job;
      const phase = (job?.phase as string) || "";
      const jobStatus = (job?.status as string) || "";

      if (i % 6 === 0) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} phase=${phase} status=${jobStatus}`);
      }

      if (phase.includes("SUCCEEDED") || phase.includes("COMPLETED")) {
        return "succeeded";
      }
      if (phase.includes("FAILED") || phase.includes("ERROR")) {
        return "failed";
      }
      if (jobStatus.includes("COMPLETED") || jobStatus.includes("NO_CHANGES")) {
        return "succeeded";
      }
      if (jobStatus.includes("FAILED")) {
        return "failed";
      }
    } catch {
      // Network error — retry
    }

    // Fallback: check individual datasource statuses
    if (i > 0 && i % 3 === 0) {
      const dsResult = await checkDatasourceIndexingStatuses(kbUuid);
      if (dsResult) return dsResult;
    }

    if (i % 6 === 0) {
      console.log(`[waitForKbIndexingComplete] Waiting... attempt=${i + 1}/${maxAttempts}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Final check before giving up
  const finalCheck = await checkDatasourceIndexingStatuses(kbUuid);
  if (finalCheck) return finalCheck;

  console.warn(`[waitForKbIndexingComplete] KB ${kbUuid} indexing did not complete in time`);
  return "timeout";
}

/**
 * Check if all datasources in a KB have completed indexing.
 */
async function checkDatasourceIndexingStatuses(
  kbUuid: string,
): Promise<"succeeded" | "failed" | null> {
  try {
    const datasources = await kbApi.listDataSources(kbUuid);
    if (datasources.length === 0) return null;

    let allTerminal = true;
    let anyFailed = false;

    for (const ds of datasources) {
      const status = (ds.last_datasource_indexing_job?.status || "") as string;
      if (!status || status.includes("UNKNOWN") || status.includes("IN_PROGRESS")) {
        allTerminal = false;
        break;
      }
      if (status.includes("FAILED") || status.includes("CANCELLED")) {
        anyFailed = true;
      }
    }

    if (!allTerminal) return null;
    return anyFailed ? "failed" : "succeeded";
  } catch {
    return null;
  }
}

// ─── Stale status recovery ──────────────────────────────

/**
 * Reconcile KBs stuck in "indexing"/"creating" by checking DO API.
 */
export async function reconcileStaleKbStatuses(
  orgId: string,
  staleKbs: Array<{ id: string; gradientKbUuid: string | null; sources: Array<{ id: string; gradientDatasourceUuid: string | null }> }>,
): Promise<void> {
  for (const kb of staleKbs) {
    if (!kb.gradientKbUuid) continue;

    try {
      // Check datasource-level statuses from DO
      const datasources = await kbApi.listDataSources(kb.gradientKbUuid);

      const doStatusMap = new Map<string, string>();
      for (const ds of datasources) {
        const status = ds.last_datasource_indexing_job?.status || "";
        doStatusMap.set(ds.uuid, status);
      }

      for (const source of kb.sources) {
        if (!source.gradientDatasourceUuid) continue;
        const doStatus = doStatusMap.get(source.gradientDatasourceUuid) || "";

        let newStatus: string | null = null;
        if (doStatus.includes("UPDATED") || doStatus.includes("NOT_UPDATED")) {
          newStatus = "ready";
        } else if (doStatus.includes("FAILED") || doStatus.includes("CANCELLED")) {
          newStatus = "failed";
        }

        if (newStatus) {
          await prisma.knowledgeSource.update({
            where: { id: source.id },
            data: { indexingStatus: newStatus },
          });
          eventBus.emit(orgId, { type: "kb:source:status", id: source.id, status: newStatus, kbId: kb.id });
        }
      }

      // Check KB-level job status
      try {
        const kbData = await kbApi.getKnowledgeBase(kb.gradientKbUuid);
        const phase = (kbData.knowledge_base?.last_indexing_job?.phase as string) || "";
        if (phase.includes("SUCCEEDED") || phase.includes("COMPLETED")) {
          await prisma.knowledgeSource.updateMany({
            where: { knowledgeBaseId: kb.id, indexingStatus: { in: ["indexing", "creating", "pending"] } },
            data: { indexingStatus: "ready" },
          });
        }
      } catch {
        // KB fetch failed — skip
      }

      // Recompute KB status from sources
      await updateKbStatus(orgId, kb.id);

      console.log(`[reconcileStaleKbStatuses] Reconciled KB ${kb.id}`);
    } catch (err) {
      console.error(`[reconcileStaleKbStatuses] Failed for KB ${kb.id}:`, err);
    }
  }
}

/**
 * Delete a knowledge base from DO.
 */
export async function deleteKnowledgeBase(kbUuid: string): Promise<void> {
  await kbApi.deleteKnowledgeBase(kbUuid);
}
