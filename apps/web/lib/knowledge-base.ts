import { prisma } from "@dochat/db";
import { eventBus } from "@/lib/event-bus";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

function getDoToken() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN not configured");
  return token;
}

export interface KbDatasource {
  file_upload_data_source?: {
    original_file_name: string;
    size_in_bytes: string;
    stored_object_key: string;
  };
  web_crawler_data_source?: {
    base_url: string;
    crawling_option: string;
    embed_media: boolean;
  };
  spaces_data_source?: {
    bucket_name: string;
    item_path: string;
    region: string;
  };
}

/**
 * Build a KbDatasource object from a source's properties.
 * Sources with a spacesObjectKey use spaces_data_source (works for both
 * KB creation and adding to existing KBs). Legacy sources with only
 * storedObjectKey fall back to file_upload_data_source.
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
  // Prefer spaces_data_source (works for adding to existing KBs)
  if (source.spacesObjectKey) {
    return {
      spaces_data_source: {
        bucket_name: process.env.SPACES_BUCKET || "dochat",
        item_path: source.spacesObjectKey,
        region: process.env.SPACES_REGION || "sgp1",
      },
    };
  }
  // Legacy fallback: file_upload_data_source (only works during KB creation)
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

/**
 * Upload a file to DO GenAI via presigned URL.
 * Returns the stored object key for use in file_upload_data_source.
 */
export async function uploadFileToDo(
  fileName: string,
  fileSize: number,
  fileBuffer: ArrayBuffer,
): Promise<string> {
  const doToken = getDoToken();

  // 1. Get presigned upload URL
  const presignRes = await fetch(
    `${DO_API_BASE}/knowledge_bases/data_sources/file_upload_presigned_urls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [{ file_name: fileName, file_size: String(fileSize) }],
      }),
    },
  );

  if (!presignRes.ok) {
    const text = await presignRes.text();
    throw new Error(`Failed to get presigned URL: ${presignRes.status} ${text}`);
  }

  const presignData = await presignRes.json();
  const upload = presignData.uploads?.[0];
  if (!upload?.presigned_url || !upload?.object_key) {
    throw new Error(`Invalid presigned URL response: ${JSON.stringify(presignData)}`);
  }

  // 2. Upload file to presigned URL
  const uploadRes = await fetch(upload.presigned_url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Failed to upload file to DO GenAI: ${uploadRes.status} ${text}`);
  }

  return upload.object_key;
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
 * Ensures the file has a proper extension (required by DO indexer).
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

  // Ensure file has an extension — DO indexer skips files without one
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
 * Each KB folder gets one DO KB. The org shares one OpenSearch database.
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
    //    - Free plan: use shared DB from env (DO_FREE_OPENSEARCH_DB_ID)
    //    - Paid plans: use org's own DB (stored on subscription)
    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    const plan = sub?.plan ?? "free";
    const isFree = plan === "free";
    let databaseId: string | undefined;

    if (isFree) {
      databaseId = process.env.DO_FREE_OPENSEARCH_DB_ID;
      if (!databaseId) {
        throw new Error("DO_FREE_OPENSEARCH_DB_ID not configured");
      }
      console.log(`[createKnowledgeBaseKb] Free plan — using shared DB: ${databaseId}`);
    } else {
      databaseId = sub?.openSearchDatabaseId || undefined;
      console.log(`[createKnowledgeBaseKb] Paid plan (${plan}) — using org DB: ${databaseId ?? "none (will provision new)"}`);
    }

    // 3. Create DO KB
    const doToken = getDoToken();
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

    let kbRes = await fetch(`${DO_API_BASE}/knowledge_bases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildKbBody(databaseId)),
    });

    // If creation failed with a stored database_id (paid plans only), the DB
    // may have been deleted on DO. Retry without it so DO provisions a fresh one.
    if (!kbRes.ok && databaseId && !isFree) {
      const errText = await kbRes.text();
      console.warn(`[createKnowledgeBaseKb] KB creation failed with database_id ${databaseId}: ${kbRes.status} ${errText} — retrying without database_id`);
      await prisma.subscription.update({
        where: { orgId },
        data: { openSearchDatabaseId: null },
      });
      databaseId = undefined;

      kbRes = await fetch(`${DO_API_BASE}/knowledge_bases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${doToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildKbBody()),
      });
    }

    if (!kbRes.ok) {
      const text = await kbRes.text();
      throw new Error(`Failed to create KB: ${kbRes.status} ${text}`);
    }

    const kbData = await kbRes.json();
    const kbUuid = kbData.knowledge_base?.uuid;
    if (!kbUuid) throw new Error("No UUID returned from KB creation");

    const returnedDbId = kbData.knowledge_base?.database_id;

    // DO API doesn't return data_sources in creation response — fetch them separately
    const datasourceUuids = await fetchDatasourceUuids(kbUuid);

    // 5. Save KB UUID to KB record + datasource UUIDs to sources
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        gradientKbUuid: kbUuid,
        indexingStatus: "indexing",
      },
    });

    // Map datasource UUIDs back to sources (best effort — by order)
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

    // 6. Save DB ID for paid plans (free users share a global DB)
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
      // Keep as indexing — don't mark ready prematurely
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
 *
 * Uses the POST /knowledge_bases/{uuid}/data_sources endpoint:
 * - web_crawler_data_source for websites
 * - spaces_data_source for files/text (uploaded to our Spaces bucket)
 */
export async function addSourceToKb(
  orgId: string,
  kbId: string,
  sourceId: string,
): Promise<void> {
  const kb = await prisma.knowledgeBase.findUniqueOrThrow({ where: { id: kbId } });
  const source = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });

  // If KB has no DO KB yet, create the entire KB with all sources
  if (!kb.gradientKbUuid) {
    await createKnowledgeBaseKb(orgId, kbId);
    return;
  }

  // Build the datasource payload
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
    // Mark source as indexing
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { indexingStatus: "indexing" },
    });
    eventBus.emit(orgId, { type: "kb:source:status", id: sourceId, status: "indexing", kbId });
    await updateKbStatus(orgId, kbId);

    const doToken = getDoToken();

    // Add datasource to existing KB (web_crawler or spaces_data_source)
    const res = await fetch(`${DO_API_BASE}/knowledge_bases/${kb.gradientKbUuid}/data_sources`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datasource),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to add datasource: ${res.status} ${text}`);
    }

    const dsData = await res.json();
    const datasourceUuid = dsData.knowledge_base_data_source?.uuid;

    if (datasourceUuid) {
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { gradientDatasourceUuid: datasourceUuid },
      });

      // Trigger indexing for this new datasource
      await waitForKbReadyAndIndex(kb.gradientKbUuid, [datasourceUuid]);
    }

    // Wait for indexing to complete
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
      // timeout — keep as indexing
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
  const doToken = getDoToken();

  const res = await fetch(
    `${DO_API_BASE}/knowledge_bases/${kbUuid}/data_sources/${datasourceUuid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    },
  ).catch((err) => {
    console.error("[removeSourceFromKb] Network error:", err);
    return null;
  });

  if (res && !res.ok) {
    const text = await res.text();
    console.error(`[removeSourceFromKb] Failed: ${res.status} ${text}`);
  }
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

// ─── Helpers ────────────────────────────────────────────

/**
 * Fetch datasource details for a KB from DO API.
 */
async function fetchDatasources(kbUuid: string): Promise<Array<{ uuid: string; last_datasource_indexing_job?: { status?: string } }>> {
  const doToken = getDoToken();
  const dsRes = await fetch(`${DO_API_BASE}/knowledge_bases/${kbUuid}/data_sources`, {
    headers: { Authorization: `Bearer ${doToken}` },
  });
  if (dsRes.ok) {
    const dsData = await dsRes.json();
    return dsData.knowledge_base_data_sources || dsData.data_sources || [];
  }
  return [];
}

/**
 * Fetch datasource UUIDs for a KB from DO API.
 */
async function fetchDatasourceUuids(kbUuid: string): Promise<string[]> {
  const datasources = await fetchDatasources(kbUuid);
  return datasources.map((ds) => ds.uuid);
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
 * Checks both KB-level last_indexing_job.phase AND individual datasource statuses.
 * Returns the result: "succeeded", "failed", or "timeout".
 */
async function waitForKbIndexingComplete(
  kbUuid: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<"succeeded" | "failed" | "timeout"> {
  const doToken = getDoToken();

  for (let i = 0; i < maxAttempts; i++) {
    // 1. Check KB-level indexing job phase
    const res = await fetch(`${DO_API_BASE}/knowledge_bases/${kbUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      const job = data.knowledge_base?.last_indexing_job;
      const phase = (job?.phase as string) || "";
      const jobStatus = (job?.status as string) || "";

      if (i % 6 === 0) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} phase=${phase} status=${jobStatus}`);
      }

      // Check phase
      if (phase.includes("SUCCEEDED") || phase.includes("COMPLETED")) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} indexing succeeded: ${phase}`);
        return "succeeded";
      }
      if (phase.includes("FAILED") || phase.includes("ERROR")) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} indexing failed: ${phase}`);
        return "failed";
      }

      // Check job status as fallback
      if (jobStatus.includes("COMPLETED") || jobStatus.includes("NO_CHANGES")) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} job status: ${jobStatus}`);
        return "succeeded";
      }
      if (jobStatus.includes("FAILED")) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} job status: ${jobStatus}`);
        return "failed";
      }
    }

    // 2. Fallback: check individual datasource statuses
    // Useful when last_indexing_job is null (e.g., auto-indexing on creation)
    if (i > 0 && i % 3 === 0) {
      const dsResult = await checkDatasourceIndexingStatuses(kbUuid);
      if (dsResult) {
        console.log(`[waitForKbIndexingComplete] KB ${kbUuid} datasource check: ${dsResult}`);
        return dsResult;
      }
    }

    if (i % 6 === 0) {
      console.log(`[waitForKbIndexingComplete] Waiting... attempt=${i + 1}/${maxAttempts}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Final datasource check before giving up
  const finalCheck = await checkDatasourceIndexingStatuses(kbUuid);
  if (finalCheck) {
    console.log(`[waitForKbIndexingComplete] KB ${kbUuid} final datasource check: ${finalCheck}`);
    return finalCheck;
  }

  console.warn(`[waitForKbIndexingComplete] KB ${kbUuid} indexing did not complete in time`);
  return "timeout";
}

/**
 * Check if all datasources in a KB have completed indexing by
 * inspecting each datasource's last_datasource_indexing_job.status.
 * Returns null if any datasource is still in progress or has no status.
 */
async function checkDatasourceIndexingStatuses(
  kbUuid: string,
): Promise<"succeeded" | "failed" | null> {
  const datasources = await fetchDatasources(kbUuid);
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
}

// ─── Stale status recovery ──────────────────────────────

/**
 * Reconcile KBs stuck in "indexing"/"creating" by checking DO API
 * and updating our DB to match. Called from the GET /api/knowledge-bases route.
 */
export async function reconcileStaleKbStatuses(
  orgId: string,
  staleKbs: Array<{ id: string; gradientKbUuid: string | null; sources: Array<{ id: string; gradientDatasourceUuid: string | null }> }>,
): Promise<void> {
  for (const kb of staleKbs) {
    if (!kb.gradientKbUuid) continue;

    try {
      // Check datasource-level statuses from DO
      const datasources = await fetchDatasources(kb.gradientKbUuid);

      // Build a map of DO datasource UUID → status
      const doStatusMap = new Map<string, string>();
      for (const ds of datasources) {
        const status = ds.last_datasource_indexing_job?.status || "";
        doStatusMap.set(ds.uuid, status);
      }

      // Update each source's status based on DO data
      for (const source of kb.sources) {
        if (!source.gradientDatasourceUuid) continue;
        const doStatus = doStatusMap.get(source.gradientDatasourceUuid) || "";

        let newStatus: string | null = null;
        if (doStatus.includes("UPDATED") || doStatus.includes("NOT_UPDATED")) {
          newStatus = "ready";
        } else if (doStatus.includes("FAILED") || doStatus.includes("CANCELLED")) {
          newStatus = "failed";
        }
        // If still IN_PROGRESS or UNKNOWN, leave as is

        if (newStatus) {
          await prisma.knowledgeSource.update({
            where: { id: source.id },
            data: { indexingStatus: newStatus },
          });
          eventBus.emit(orgId, { type: "kb:source:status", id: source.id, status: newStatus, kbId: kb.id });
        }
      }

      // Also check KB-level job status
      const doToken = getDoToken();
      const kbRes = await fetch(`${DO_API_BASE}/knowledge_bases/${kb.gradientKbUuid}`, {
        headers: { Authorization: `Bearer ${doToken}` },
      });
      if (kbRes.ok) {
        const kbData = await kbRes.json();
        const phase = (kbData.knowledge_base?.last_indexing_job?.phase as string) || "";
        if (phase.includes("SUCCEEDED") || phase.includes("COMPLETED")) {
          // All done — mark any remaining "indexing" sources as "ready"
          await prisma.knowledgeSource.updateMany({
            where: { knowledgeBaseId: kb.id, indexingStatus: { in: ["indexing", "creating", "pending"] } },
            data: { indexingStatus: "ready" },
          });
        }
      }

      // Recompute KB status from sources
      await updateKbStatus(orgId, kb.id);

      console.log(`[reconcileStaleKbStatuses] Reconciled KB ${kb.id}`);
    } catch (err) {
      console.error(`[reconcileStaleKbStatuses] Failed for KB ${kb.id}:`, err);
    }
  }
}

// ─── Low-level DO API helpers ───────────────────────────

/**
 * Trigger an indexing job for specific data sources in a KB.
 */
export async function triggerIndexing(
  kbUuid: string,
  dataSourceUuids: string[],
): Promise<void> {
  const doToken = getDoToken();

  const res = await fetch(`${DO_API_BASE}/indexing_jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      knowledge_base_uuid: kbUuid,
      data_source_uuids: dataSourceUuids,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[triggerIndexing] Failed: ${res.status} ${text}`);
  }
}

/**
 * Delete a knowledge base entirely.
 */
export async function deleteKnowledgeBase(kbUuid: string): Promise<void> {
  const doToken = getDoToken();

  const res = await fetch(`${DO_API_BASE}/knowledge_bases/${kbUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch((err) => { console.error("[deleteKnowledgeBase] Network error:", err); return null; });
  if (res && !res.ok) {
    const text = await res.text();
    console.error(`[deleteKnowledgeBase] Failed: ${res.status} ${text}`);
  }
}
