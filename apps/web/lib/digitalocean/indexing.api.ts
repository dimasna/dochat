import { doFetch } from "./client";

/**
 * Start an indexing job for specific datasources in a KB.
 * POST /v2/gen-ai/indexing_jobs (takes knowledge_base_uuid in body).
 */
export async function createIndexingJob(
  kbUuid: string,
  dataSourceUuids: string[],
): Promise<void> {
  await doFetch("POST", "/indexing_jobs", {
    body: {
      knowledge_base_uuid: kbUuid,
      data_source_uuids: dataSourceUuids,
    },
  });
}
