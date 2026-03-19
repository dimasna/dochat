import { doFetch, doFetchSafe } from "./client";
import type { DoWorkspaceCreateInput, DoWorkspaceResponse } from "./types";

export async function createWorkspace(
  input: DoWorkspaceCreateInput,
): Promise<DoWorkspaceResponse> {
  return doFetch<DoWorkspaceResponse>("POST", "/workspaces", { body: input });
}

export async function deleteWorkspace(workspaceUuid: string): Promise<void> {
  await doFetchSafe("DELETE", `/workspaces/${workspaceUuid}`);
}
