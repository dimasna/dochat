import { prisma } from "@dochat/db";
import { SUPPORT_AGENT_PROMPT } from "@dochat/shared";
import { eventBus } from "@/lib/event-bus";
import { agentsApi, workspacesApi, doFetchRaw } from "@/lib/digitalocean";
import type { DoAgentCreateInput } from "@/lib/digitalocean";

// Prevents duplicate recovery attempts for the same agent
const recoveringAgentIds = new Set<string>();

interface AgentInfo {
  agentEndpoint: string;
  agentAccessKey: string;
}

// ─── Helpers ────────────────────────────────────────────

function buildSafeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function getModelUuid(): string {
  const uuid = process.env.DO_AGENT_MODEL_UUID;
  if (!uuid) throw new Error("DO_AGENT_MODEL_UUID not configured");
  return uuid;
}

function buildAgentInput(
  name: string,
  instruction: string,
  kbUuids: string[],
): DoAgentCreateInput {
  const input: DoAgentCreateInput = {
    name: buildSafeName(name),
    model_uuid: getModelUuid(),
    instruction,
    description: `Dochat agent: ${name}`,
    region: process.env.DO_AGENT_REGION || "tor1",
    project_id: process.env.DO_PROJECT_ID,
  };
  if (kbUuids.length > 0) {
    input.knowledge_base_uuid = kbUuids;
  }
  return input;
}

async function createWorkspaceForAgent(
  agentName: string,
  agentUuid: string,
): Promise<string> {
  try {
    const res = await workspacesApi.createWorkspace({
      name: `${buildSafeName(agentName)}-workspace`,
      description: `Workspace for ${agentName}`,
      agent_uuids: [agentUuid],
    });
    return res.workspace?.uuid || "";
  } catch (err) {
    console.warn("[agent] Workspace creation error:", err);
    return "";
  }
}

// ─── Agent provisioning ──────────────────────────────────

/**
 * Provision a new DO GenAI agent for an org.
 * If knowledgeBaseIds provided: all must be "ready" (indexed).
 * Returns immediately with status "provisioning".
 */
export async function provisionAgent(
  orgId: string,
  name: string,
  instruction?: string,
  knowledgeBaseIds?: string[],
) {
  const agentInstruction = instruction || SUPPORT_AGENT_PROMPT;

  // Collect KB UUIDs from ready knowledge bases
  let kbUuids: string[] = [];
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    const kbs = await prisma.knowledgeBase.findMany({
      where: { id: { in: knowledgeBaseIds }, indexingStatus: "ready" },
    });
    kbUuids = kbs
      .map((kb) => kb.gradientKbUuid)
      .filter((uuid): uuid is string => !!uuid);
  }

  // Create agent on DO
  const agentData = await agentsApi.createAgent(
    buildAgentInput(name, agentInstruction, kbUuids),
  );
  const agentUuid = agentData.agent?.uuid;
  if (!agentUuid) throw new Error("No UUID returned from agent creation");

  // Create workspace (best-effort)
  const workspaceUuid = await createWorkspaceForAgent(name, agentUuid);

  // Save to DB
  const agent = await prisma.agent.create({
    data: {
      orgId,
      agentUuid,
      agentEndpoint: "",
      agentAccessKey: "",
      workspaceUuid,
      name,
      instruction: agentInstruction,
      status: "provisioning",
    },
  });

  eventBus.emit(orgId, { type: "agent:status", id: agent.id, status: "provisioning" });

  // Create AgentKnowledgeBase records
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    await prisma.agentKnowledgeBase.createMany({
      data: knowledgeBaseIds.map((kbId) => ({
        agentId: agent.id,
        knowledgeBaseId: kbId,
      })),
      skipDuplicates: true,
    });
  }

  return agent;
}

/**
 * Recreate the DO agent with a new set of KB UUIDs.
 * DO API only links KBs at agent creation time, so we must delete + recreate.
 */
export async function recreateAgentWithKbs(
  agentId: string,
  kbUuids: string[],
): Promise<void> {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });

  // Delete old agent + workspace (best effort)
  await agentsApi.deleteAgent(agent.agentUuid);
  if (agent.workspaceUuid) {
    await workspacesApi.deleteWorkspace(agent.workspaceUuid);
  }

  // Create new agent with KBs
  const agentData = await agentsApi.createAgent(
    buildAgentInput(agent.name, agent.instruction || SUPPORT_AGENT_PROMPT, kbUuids),
  );
  const newAgentUuid = agentData.agent?.uuid;
  if (!newAgentUuid) throw new Error("No UUID returned from agent recreation");

  // Create new workspace (best-effort)
  const workspaceUuid = await createWorkspaceForAgent(agent.name, newAgentUuid);

  // Update DB
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      agentUuid: newAgentUuid,
      workspaceUuid,
      agentEndpoint: "",
      agentAccessKey: "",
      status: "provisioning",
    },
  });
  eventBus.emit(agent.orgId, { type: "agent:status", id: agentId, status: "provisioning" });

  console.log(`[recreateAgentWithKbs] Agent ${agentId} recreated: ${newAgentUuid} with ${kbUuids.length} KBs`);
}

/**
 * Sync an agent's KB attachments by recreating the agent.
 * DO API only links KBs at creation time (attach/detach endpoints are broken).
 * Accepts DB agent ID (not DO UUID).
 */
export async function syncAgentKbs(
  agentId: string,
  kbUuids: string[],
): Promise<void> {
  await recreateAgentWithKbs(agentId, kbUuids);
}

// ─── Agent finalization ─────────────────────────────────

/**
 * Non-blocking check: if the DO agent is deployed, finalize it.
 * Called from the GET endpoint during UI polling.
 */
export async function tryFinalizeAgent(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || (agent.status !== "provisioning" && agent.status !== "recovering")) return false;

  try {
    const data = await agentsApi.getAgent(agent.agentUuid);
    const deploymentUrl = data.agent?.deployment?.url;
    if (!deploymentUrl) return false;

    const accessKey = await agentsApi.createApiKey(agent.agentUuid, "dochat-app");

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        agentEndpoint: deploymentUrl,
        agentAccessKey: accessKey,
        status: "active",
      },
    });
    eventBus.emit(agent.orgId, { type: "agent:status", id: agentId, status: "active" });

    console.log(`[tryFinalizeAgent] Agent ${agentId} finalized: ${deploymentUrl}`);
    return true;
  } catch (err) {
    console.error("[tryFinalizeAgent] Error:", err);
    return false;
  }
}

/**
 * Get an active agent's endpoint info. Tries finalization if still provisioning.
 */
export async function getAgent(agentId: string): Promise<AgentInfo> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  if (agent.status === "active" && agent.agentEndpoint && agent.agentAccessKey) {
    return {
      agentEndpoint: agent.agentEndpoint,
      agentAccessKey: agent.agentAccessKey,
    };
  }

  if (agent.status === "provisioning" || agent.status === "recovering") {
    const finalized = await tryFinalizeAgent(agentId);
    if (finalized) {
      const updated = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
      return {
        agentEndpoint: updated.agentEndpoint,
        agentAccessKey: updated.agentAccessKey,
      };
    }
    throw new Error(`Agent ${agentId} is still ${agent.status}. Please try again shortly.`);
  }

  throw new Error(`Agent ${agentId} is in status: ${agent.status}`);
}

/**
 * Create a new access key for an agent and update the DB.
 */
async function refreshAgentAccessKey(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const newKey = await agentsApi.createApiKey(agent.agentUuid, "dochat-app");
  await prisma.agent.update({
    where: { id: agentId },
    data: { agentAccessKey: newKey },
  });
  console.log(`[refreshAgentAccessKey] Refreshed access key for agent ${agentId}`);
  return newKey;
}

// ─── Agent update/delete ────────────────────────────────

/**
 * Update an agent on DO (uses GET+PUT since PATCH returns 405).
 */
export async function updateDoAgent(
  agentUuid: string,
  updates: { name?: string; instruction?: string },
) {
  const data = await agentsApi.getAgent(agentUuid);
  const current = data.agent;
  if (!current) throw new Error("No agent data returned from DO");

  const safeName = buildSafeName(updates.name || current.name || "");

  const putBody: Record<string, unknown> = {
    name: safeName,
    model_uuid: current.model?.uuid || getModelUuid(),
    instruction: updates.instruction ?? current.instruction,
    description: current.description,
    region: current.region || process.env.DO_AGENT_REGION || "tor1",
    project_id: current.project_id || process.env.DO_PROJECT_ID,
  };

  if (current.knowledge_bases && current.knowledge_bases.length > 0) {
    putBody.knowledge_base_uuid = current.knowledge_bases.map(
      (kb: { uuid: string }) => kb.uuid,
    );
  }

  return agentsApi.updateAgent(agentUuid, putBody as any);
}

/**
 * Toggle agent visibility on DO and update the DB.
 */
export async function updateAgentVisibility(agentId: string, isPublic: boolean) {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });

  if (agent.status === "active" && agent.agentUuid) {
    const visibility = isPublic ? "VISIBILITY_PUBLIC" : "VISIBILITY_PRIVATE";
    await agentsApi.updateVisibility(agent.agentUuid, visibility);
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: { isPublic },
  });
}

/**
 * Delete an agent from DO (agent + workspace). KBs are NOT deleted.
 */
export async function deleteDoAgent(agent: {
  agentUuid: string;
  workspaceUuid: string;
}) {
  await agentsApi.deleteAgent(agent.agentUuid);
  if (agent.workspaceUuid) {
    await workspacesApi.deleteWorkspace(agent.workspaceUuid);
  }
}

// ─── Chat with agent ────────────────────────────────────

/**
 * Generate a response from a specific agent.
 */
export async function generateAgentResponse(
  conversationId: string,
  agentId: string,
  userMessage: string,
): Promise<{ content: string; toolCalls?: Array<{ name: string; result: string }> }> {
  const agent = await getAgent(agentId);

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages = [
    ...history.map((m) => ({
      role: m.role === "support" ? "assistant" : m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const callAgent = async (accessKey: string) => {
    return doFetchRaw("POST", `${agent.agentEndpoint}/api/v1/chat/completions`, {
      token: accessKey,
      body: {
        messages,
        stream: false,
        include_retrieval_info: true,
      },
      signal: AbortSignal.timeout(60_000),
    });
  };

  let res = await callAgent(agent.agentAccessKey);

  // If access key expired/invalid, refresh it and retry once
  if (res.status === 401 || res.status === 403) {
    console.log(`[generateAgentResponse] Access key rejected (${res.status}), refreshing...`);
    const newKey = await refreshAgentAccessKey(agentId);
    res = await callAgent(newKey);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agent API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const responseContent = data.choices?.[0]?.message?.content || "";

  return postProcessResponse(conversationId, responseContent);
}

// ─── Health check & recovery ─────────────────────────────

/**
 * Lightweight health check: ping the agent endpoint.
 */
export async function checkAgentEndpointHealth(agentEndpoint: string): Promise<boolean> {
  try {
    await fetch(`${agentEndpoint}/api/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recover a stale agent by deleting and recreating it on DO.
 * Idempotent — skips if recovery is already in progress.
 */
export async function recoverAgent(agentId: string): Promise<void> {
  if (recoveringAgentIds.has(agentId)) {
    console.log(`[recoverAgent] Recovery already in progress for ${agentId}`);
    return;
  }

  recoveringAgentIds.add(agentId);

  try {
    const agent = await prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: {
        knowledgeBases: {
          include: { knowledgeBase: true },
        },
      },
    });

    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "recovering" },
    });
    eventBus.emit(agent.orgId, { type: "agent:status", id: agentId, status: "recovering" });

    const kbUuids = agent.knowledgeBases
      .map((akb) => akb.knowledgeBase.gradientKbUuid)
      .filter((uuid): uuid is string => !!uuid);

    await recreateAgentWithKbs(agentId, kbUuids);

    console.log(`[recoverAgent] Recovery initiated for ${agentId}, now provisioning`);
  } catch (err) {
    console.error(`[recoverAgent] Failed for ${agentId}:`, err);
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "failed" },
    }).catch(() => {});
  } finally {
    recoveringAgentIds.delete(agentId);
  }
}

// ─── Post-processing for escalation/resolution ──────────

const ESCALATE_PATTERN = /\[ESCALATE:\s*(.+?)\]/i;
const RESOLVE_PATTERN = /\[RESOLVE:\s*(.+?)\]/i;

async function postProcessResponse(
  conversationId: string,
  content: string,
): Promise<{ content: string; toolCalls?: Array<{ name: string; result: string }> }> {
  const toolCalls: Array<{ name: string; result: string }> = [];
  let cleanContent = content;

  const escalateMatch = content.match(ESCALATE_PATTERN);
  if (escalateMatch) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "escalated" },
    });
    toolCalls.push({ name: "escalate_conversation", result: `Escalated: ${escalateMatch[1]}` });
    cleanContent = cleanContent.replace(ESCALATE_PATTERN, "").trim();
  }

  const resolveMatch = content.match(RESOLVE_PATTERN);
  if (resolveMatch) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "resolved" },
    });
    toolCalls.push({ name: "resolve_conversation", result: `Resolved: ${resolveMatch[1]}` });
    cleanContent = cleanContent.replace(RESOLVE_PATTERN, "").trim();
  }

  return {
    content: cleanContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}
