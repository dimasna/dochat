import { doFetch, doFetchSafe } from "./client";
import type {
  DoAgentCreateInput,
  DoAgentUpdateInput,
  DoAgentResponse,
  DoApiKeyResponse,
  DoVisibility,
} from "./types";

export async function createAgent(
  input: DoAgentCreateInput,
): Promise<DoAgentResponse> {
  return doFetch<DoAgentResponse>("POST", "/agents", { body: input });
}

export async function getAgent(agentUuid: string): Promise<DoAgentResponse> {
  return doFetch<DoAgentResponse>("GET", `/agents/${agentUuid}`);
}

export async function updateAgent(
  agentUuid: string,
  input: DoAgentUpdateInput,
): Promise<DoAgentResponse> {
  return doFetch<DoAgentResponse>("PUT", `/agents/${agentUuid}`, {
    body: input,
  });
}

export async function deleteAgent(agentUuid: string): Promise<void> {
  await doFetchSafe("DELETE", `/agents/${agentUuid}`);
}

/**
 * Create an API key for an agent. Returns the secret key string.
 * Normalizes the inconsistent DO response format.
 */
export async function createApiKey(
  agentUuid: string,
  name: string,
): Promise<string> {
  const data = await doFetch<DoApiKeyResponse>(
    "POST",
    `/agents/${agentUuid}/api_keys`,
    { body: { name } },
  );

  const key =
    data.api_key_info?.secret_key ||
    data.api_key?.api_key ||
    data.api_key?.key;

  if (!key) {
    throw new Error(
      `No access key in response: ${JSON.stringify(data)}`,
    );
  }
  return key;
}

/**
 * Update agent deployment visibility.
 * Must use dedicated endpoint — visibility in PUT body is silently ignored.
 */
export async function updateVisibility(
  agentUuid: string,
  visibility: DoVisibility,
): Promise<void> {
  await doFetch("PUT", `/agents/${agentUuid}/deployment_visibility`, {
    body: { uuid: agentUuid, visibility },
  });
}
