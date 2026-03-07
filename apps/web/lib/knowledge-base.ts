const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

function getDoToken() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN not configured");
  return token;
}

export interface KbDatasource {
  spaces_data_source?: {
    bucket_name: string;
    item_path: string;
    region: string;
  };
  web_crawler_data_source?: {
    base_url: string;
    crawling_option: string;
    embed_media: boolean;
  };
}

export interface CreateKbResult {
  kbUuid: string;
  datasourceUuids: string[];
}

/**
 * Create a new knowledge base in DigitalOcean GenAI.
 * Requires at least one datasource (DO API rejects empty KBs).
 * Returns the KB UUID and datasource UUIDs.
 */
export async function createKnowledgeBase(
  name: string,
  datasources: KbDatasource[],
): Promise<CreateKbResult> {
  const doToken = getDoToken();
  const embeddingModel = process.env.DO_EMBEDDING_MODEL_UUID;
  if (!embeddingModel) throw new Error("DO_EMBEDDING_MODEL_UUID not configured");

  const res = await fetch(`${DO_API_BASE}/knowledge_bases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      embedding_model_uuid: embeddingModel,
      region: process.env.DO_AGENT_REGION || "tor1",
      project_id: process.env.DO_PROJECT_ID,
      datasources,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create knowledge base: ${res.status} ${text}`);
  }

  const data = await res.json();
  const kbUuid = data.knowledge_base?.uuid;
  if (!kbUuid) throw new Error("No UUID returned from KB creation");

  const datasourceUuids = (data.knowledge_base?.data_sources || [])
    .map((ds: Record<string, unknown>) => ds.uuid as string)
    .filter(Boolean);

  return { kbUuid, datasourceUuids };
}

/**
 * Build a KbDatasource object from a document's properties.
 */
export function buildDatasource(doc: {
  sourceType: string;
  sourceUrl: string | null;
  spacesKey: string | null;
}): KbDatasource | null {
  if (doc.sourceType === "website" && doc.sourceUrl) {
    return {
      web_crawler_data_source: {
        base_url: doc.sourceUrl,
        crawling_option: "SCOPED",
        embed_media: true,
      },
    };
  }
  if (doc.spacesKey) {
    return {
      spaces_data_source: {
        bucket_name: process.env.DO_SPACES_BUCKET!,
        item_path: `/${doc.spacesKey}`,
        region: process.env.DO_SPACES_REGION || "sgp1",
      },
    };
  }
  return null;
}

/**
 * Add a data source (file from Spaces) to a KB.
 */
export async function addDataSourceToKb(
  kbUuid: string,
  spacesKey: string,
): Promise<string | null> {
  const doToken = getDoToken();

  const res = await fetch(
    `${DO_API_BASE}/knowledge_bases/${kbUuid}/data_sources`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spaces_data_source: {
          bucket_name: process.env.DO_SPACES_BUCKET,
          item_path: `/${spacesKey}`,
          region: process.env.DO_SPACES_REGION || "sgp1",
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[addDataSourceToKb] Failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  return data.knowledge_base_data_source?.uuid ?? null;
}

/**
 * Add a web crawler data source to a KB.
 */
export async function addWebCrawlerToKb(
  kbUuid: string,
  url: string,
  crawlingOption: "SCOPED" | "PATH" | "DOMAIN" | "SUBDOMAINS" | "SITEMAP" = "SCOPED",
): Promise<string | null> {
  const doToken = getDoToken();

  const res = await fetch(
    `${DO_API_BASE}/knowledge_bases/${kbUuid}/data_sources`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        web_crawler_data_source: {
          base_url: url,
          crawling_option: crawlingOption,
          embed_media: true,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[addWebCrawlerToKb] Failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  return data.knowledge_base_data_source?.uuid ?? null;
}

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
 * Remove a data source from a KB.
 */
export async function removeDataSourceFromKb(
  kbUuid: string,
  dataSourceUuid: string,
): Promise<void> {
  const doToken = getDoToken();

  await fetch(
    `${DO_API_BASE}/knowledge_bases/${kbUuid}/data_sources/${dataSourceUuid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    },
  ).catch(() => {}); // Best effort
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
