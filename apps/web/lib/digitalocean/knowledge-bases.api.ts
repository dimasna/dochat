import { doFetch, doFetchSafe } from "./client";
import type {
  DoKbCreateInput,
  DoKbResponse,
  DoKbDatasource,
  DoKbDataSourceRecord,
  DoKbDataSourceResponse,
  DoPresignedUrlFile,
  DoPresignedUrlResponse,
} from "./types";

export async function createKnowledgeBase(
  input: DoKbCreateInput,
): Promise<DoKbResponse> {
  return doFetch<DoKbResponse>("POST", "/knowledge_bases", { body: input });
}

export async function getKnowledgeBase(
  kbUuid: string,
): Promise<DoKbResponse> {
  return doFetch<DoKbResponse>("GET", `/knowledge_bases/${kbUuid}`);
}

export async function deleteKnowledgeBase(kbUuid: string): Promise<void> {
  await doFetchSafe("DELETE", `/knowledge_bases/${kbUuid}`);
}

/**
 * List datasources for a KB.
 * Normalizes the inconsistent response key (knowledge_base_data_sources vs data_sources).
 */
export async function listDataSources(
  kbUuid: string,
): Promise<DoKbDataSourceRecord[]> {
  const data = await doFetch<Record<string, unknown>>(
    "GET",
    `/knowledge_bases/${kbUuid}/data_sources`,
  );
  return (
    (data.knowledge_base_data_sources as DoKbDataSourceRecord[]) ||
    (data.data_sources as DoKbDataSourceRecord[]) ||
    []
  );
}

export async function addDataSource(
  kbUuid: string,
  datasource: DoKbDatasource,
): Promise<DoKbDataSourceResponse> {
  return doFetch<DoKbDataSourceResponse>(
    "POST",
    `/knowledge_bases/${kbUuid}/data_sources`,
    { body: datasource },
  );
}

export async function deleteDataSource(
  kbUuid: string,
  datasourceUuid: string,
): Promise<void> {
  await doFetchSafe(
    "DELETE",
    `/knowledge_bases/${kbUuid}/data_sources/${datasourceUuid}`,
  );
}

export async function getPresignedUploadUrls(
  files: DoPresignedUrlFile[],
): Promise<DoPresignedUrlResponse> {
  return doFetch<DoPresignedUrlResponse>(
    "POST",
    "/knowledge_bases/data_sources/file_upload_presigned_urls",
    { body: { files } },
  );
}
