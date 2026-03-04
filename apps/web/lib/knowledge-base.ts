import { prisma } from "@dochat/db";

const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

function getDoToken() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN not configured");
  return token;
}

/**
 * Get the KB UUID for an org.
 * Uses DO_KNOWLEDGE_BASE_UUID env var as the shared KB,
 * or falls back to fetching the first available KB from the API.
 */
export async function getOrCreateKnowledgeBase(orgId: string): Promise<string> {
  // Check if org already has a KB mapping
  const existing = await prisma.knowledgeBase.findUnique({
    where: { orgId },
  });

  if (existing) {
    return existing.gradientKbUuid;
  }

  // Use the shared KB UUID from env, or auto-detect
  const kbUuid = await getSharedKbUuid();

  // Store the mapping for this org
  await prisma.knowledgeBase.create({
    data: {
      orgId,
      gradientKbUuid: kbUuid,
      name: `dochat-${orgId}`,
    },
  });

  return kbUuid;
}

/**
 * Get the shared KB UUID from env or by listing existing KBs.
 */
async function getSharedKbUuid(): Promise<string> {
  const envUuid = process.env.DO_KNOWLEDGE_BASE_UUID;
  if (envUuid) return envUuid;

  const doToken = getDoToken();
  const res = await fetch(`${DO_API_BASE}/knowledge_bases`, {
    headers: { Authorization: `Bearer ${doToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list knowledge bases: ${res.status}`);
  }

  const data = await res.json();
  const kbs = data.knowledge_bases || [];
  if (kbs.length === 0) {
    throw new Error(
      "No knowledge base found. Create one in the DigitalOcean console and set DO_KNOWLEDGE_BASE_UUID.",
    );
  }

  return kbs[0].uuid;
}

/**
 * Get the KB UUID for an org, or null if none exists yet.
 */
export async function getKnowledgeBaseUuid(orgId: string): Promise<string | null> {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { orgId },
    select: { gradientKbUuid: true },
  });
  return kb?.gradientKbUuid ?? null;
}

/**
 * Add a data source (file from Spaces) to the org's KB.
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
 * Add a web crawler data source to the org's KB.
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
    console.error(`[triggerIndexing] Failed: ${res.status} ${text}`);
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
 * Search the org's KB for relevant content.
 */
export async function searchKb(
  kbUuid: string,
  query: string,
  numResults = 5,
): Promise<string> {
  const doToken = getDoToken();

  const res = await fetch(
    `https://kbaas.do-ai.run/v1/${kbUuid}/retrieve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        num_results: numResults,
        alpha: 0.7,
      }),
    },
  );

  if (!res.ok) {
    return "Failed to search knowledge base.";
  }

  const data = await res.json();
  const chunks = (data.results || [])
    .map((r: { content: string }) => r.content)
    .filter(Boolean);

  return chunks.length > 0
    ? chunks.join("\n---\n")
    : "No relevant information found in the knowledge base.";
}
