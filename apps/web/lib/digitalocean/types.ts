// ─── Agent Types ─────────────────────────────────────────

export interface DoAgentCreateInput {
  name: string;
  model_uuid: string;
  instruction: string;
  description?: string;
  region?: string;
  project_id?: string;
  knowledge_base_uuid?: string[];
}

export interface DoAgentUpdateInput {
  name: string;
  model_uuid: string;
  instruction: string;
  description?: string;
  region?: string;
  project_id?: string;
  knowledge_base_uuid?: string[];
}

export interface DoAgent {
  uuid: string;
  name: string;
  instruction: string;
  description?: string;
  region?: string;
  project_id?: string;
  model?: { uuid: string };
  deployment?: { url?: string };
  knowledge_bases?: Array<{ uuid: string }>;
}

export interface DoAgentResponse {
  agent: DoAgent;
}

export type DoVisibility = "VISIBILITY_PUBLIC" | "VISIBILITY_PRIVATE";

// ─── API Key Types ───────────────────────────────────────

export interface DoApiKeyResponse {
  api_key_info?: { secret_key?: string };
  api_key?: { api_key?: string; key?: string };
}

// ─── Workspace Types ─────────────────────────────────────

export interface DoWorkspaceCreateInput {
  name: string;
  description?: string;
  agent_uuids?: string[];
}

export interface DoWorkspaceResponse {
  workspace: { uuid: string; name: string };
}

// ─── Knowledge Base Types ────────────────────────────────

export interface DoKbCreateInput {
  name: string;
  embedding_model_uuid: string;
  region?: string;
  project_id?: string;
  database_id?: string;
  datasources: DoKbDatasource[];
}

export interface DoKnowledgeBase {
  uuid: string;
  name: string;
  database_id?: string;
  last_indexing_job?: {
    phase?: string;
    status?: string;
  };
}

export interface DoKbResponse {
  knowledge_base: DoKnowledgeBase;
}

export interface DoKbDatasource {
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

export interface DoKbDataSourceRecord {
  uuid: string;
  last_datasource_indexing_job?: {
    status?: string;
  };
}

export interface DoKbDataSourceResponse {
  knowledge_base_data_source?: { uuid: string };
}

// ─── Indexing Types ──────────────────────────────────────

export interface DoIndexingJobInput {
  knowledge_base_uuid: string;
  data_source_uuids: string[];
}

// ─── File Upload Types ───────────────────────────────────

export interface DoPresignedUrlFile {
  file_name: string;
  file_size: string;
}

export interface DoPresignedUrlResponse {
  uploads: Array<{
    presigned_url: string;
    object_key: string;
  }>;
}
