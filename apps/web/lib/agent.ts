import { prisma } from "@dochat/db";
import { SUPPORT_AGENT_PROMPT } from "@dochat/shared";
import { eventBus } from "@/lib/event-bus";

const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

// Prevents duplicate recovery attempts for the same agent
const recoveringAgentIds = new Set<string>();

function getDoToken() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN not configured");
  return token;
}

// ─── Agent provisioning ──────────────────────────────────

interface AgentInfo {
  agentEndpoint: string;
  agentAccessKey: string;
}

/**
 * Provision a new DO GenAI agent for an org.
 * If knowledgeBaseIds provided: all must be "ready" (indexed). Their KB UUIDs are included at creation time.
 * Returns immediately with status "provisioning".
 */
export async function provisionAgent(
  orgId: string,
  name: string,
  instruction?: string,
  knowledgeBaseIds?: string[],
) {
  const doToken = getDoToken();
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").toLowerCase();
  const modelUuid = process.env.DO_AGENT_MODEL_UUID;
  if (!modelUuid) throw new Error("DO_AGENT_MODEL_UUID not configured");

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

  // Create agent (with KBs if available)
  const agentBody: Record<string, unknown> = {
    name: safeName,
    model_uuid: modelUuid,
    instruction: agentInstruction,
    description: `Dochat agent: ${name}`,
    region: process.env.DO_AGENT_REGION || "tor1",
    project_id: process.env.DO_PROJECT_ID,
  };
  if (kbUuids.length > 0) {
    agentBody.knowledge_base_uuid = kbUuids;
  }

  const agentRes = await fetch(`${DO_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(agentBody),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    throw new Error(`Failed to create agent: ${agentRes.status} ${text}`);
  }

  const agentData = await agentRes.json();
  const agentUuid = agentData.agent?.uuid;
  if (!agentUuid) throw new Error("No UUID returned from agent creation");

  // Create workspace
  let workspaceUuid = "";
  try {
    const wsRes = await fetch(`${DO_API_BASE}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${safeName}-workspace`,
        description: `Workspace for ${name}`,
        agent_uuids: [agentUuid],
      }),
    });
    if (wsRes.ok) {
      const wsData = await wsRes.json();
      workspaceUuid = wsData.workspace?.uuid || "";
    }
  } catch (err) {
    console.warn("[agent] Workspace creation error:", err);
  }

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
 * Used when attaching/detaching knowledge bases to an active agent.
 */
export async function recreateAgentWithKbs(
  agentId: string,
  kbUuids: string[],
): Promise<void> {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const doToken = getDoToken();
  const modelUuid = process.env.DO_AGENT_MODEL_UUID;
  if (!modelUuid) throw new Error("DO_AGENT_MODEL_UUID not configured");

  const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").toLowerCase();

  // Delete old agent + workspace (best effort)
  await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch(() => {});

  if (agent.workspaceUuid) {
    await fetch(`${DO_API_BASE}/workspaces/${agent.workspaceUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    }).catch(() => {});
  }

  // Create new agent with KBs
  const agentBody: Record<string, unknown> = {
    name: safeName,
    model_uuid: modelUuid,
    instruction: agent.instruction || SUPPORT_AGENT_PROMPT,
    description: `Dochat agent: ${agent.name}`,
    region: process.env.DO_AGENT_REGION || "tor1",
    project_id: process.env.DO_PROJECT_ID,
  };
  if (kbUuids.length > 0) {
    agentBody.knowledge_base_uuid = kbUuids;
  }

  const agentRes = await fetch(`${DO_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(agentBody),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    throw new Error(`Failed to recreate agent: ${agentRes.status} ${text}`);
  }

  const agentData = await agentRes.json();
  const newAgentUuid = agentData.agent?.uuid;
  if (!newAgentUuid) throw new Error("No UUID returned from agent recreation");

  // Create new workspace
  let workspaceUuid = "";
  try {
    const wsRes = await fetch(`${DO_API_BASE}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${safeName}-workspace`,
        description: `Workspace for ${agent.name}`,
        agent_uuids: [newAgentUuid],
      }),
    });
    if (wsRes.ok) {
      const wsData = await wsRes.json();
      workspaceUuid = wsData.workspace?.uuid || "";
    }
  } catch {
    console.warn("[recreateAgentWithKbs] Workspace creation failed");
  }

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
 * Attach knowledge bases to an existing DO agent.
 * POST /v2/gen-ai/agents/{agent_uuid}/knowledge_bases
 */
export async function attachKbsToAgent(
  agentUuid: string,
  kbUuids: string[],
): Promise<void> {
  if (kbUuids.length === 0) return;
  const doToken = getDoToken();

  const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}/knowledge_bases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_uuid: agentUuid,
      knowledge_base_uuids: kbUuids,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to attach KBs to agent: ${res.status} ${text}`);
  }
}

/**
 * Detach a single knowledge base from an existing DO agent.
 * DELETE /v2/gen-ai/agents/{agent_uuid}/knowledge_bases/{kb_uuid}
 */
export async function detachKbFromAgent(
  agentUuid: string,
  kbUuid: string,
): Promise<void> {
  const doToken = getDoToken();

  const res = await fetch(
    `${DO_API_BASE}/agents/${agentUuid}/knowledge_bases/${kbUuid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to detach KB from agent: ${res.status} ${text}`);
  }
}

/**
 * Sync the DO agent's KB attachments to match what our DB says.
 * Fetches the agent's current KBs from DO, then detaches stale ones
 * and attaches missing ones.
 */
export async function syncAgentKbs(
  agentUuid: string,
  expectedKbUuids: string[],
): Promise<void> {
  const doToken = getDoToken();

  // Get what DO agent currently has
  const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
    headers: { Authorization: `Bearer ${doToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch DO agent: ${res.status}`);
  }
  const data = await res.json();
  const currentKbUuids = new Set<string>(
    (data.agent?.knowledge_bases || []).map((kb: { uuid: string }) => kb.uuid),
  );

  const expectedSet = new Set(expectedKbUuids);

  // Detach KBs that shouldn't be there
  for (const uuid of currentKbUuids) {
    if (!expectedSet.has(uuid)) {
      await detachKbFromAgent(agentUuid, uuid).catch((err) =>
        console.warn(`[syncAgentKbs] Failed to detach stale KB ${uuid}:`, err.message),
      );
    }
  }

  // Attach KBs that are missing
  const toAttach = expectedKbUuids.filter((uuid) => !currentKbUuids.has(uuid));
  if (toAttach.length > 0) {
    await attachKbsToAgent(agentUuid, toAttach);
  }
}

// ─── Agent finalization ─────────────────────────────────

/**
 * Non-blocking check: if the DO agent is deployed, finalize it.
 * Called from the GET endpoint during UI polling.
 */
export async function tryFinalizeAgent(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || (agent.status !== "provisioning" && agent.status !== "recovering")) return false;

  const doToken = getDoToken();

  try {
    const res = await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });
    if (!res.ok) return false;

    const data = await res.json();
    const deploymentUrl = data.agent?.deployment?.url;
    if (!deploymentUrl) return false;

    const accessKey = await createAgentAccessKey(agent.agentUuid, doToken);

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
 * Get an active agent's endpoint info. Waits for deployment if still provisioning.
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
    // Try a single non-blocking check instead of polling for minutes
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


async function createAgentAccessKey(agentUuid: string, doToken: string): Promise<string> {
  const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}/api_keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "dochat-app" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create agent access key: ${res.status} ${text}`);
  }

  const data = await res.json();
  const key = data.api_key_info?.secret_key || data.api_key?.api_key || data.api_key?.key;
  if (!key) throw new Error(`No access key returned. Response: ${JSON.stringify(data)}`);
  return key;
}

/**
 * Create a new access key for an agent and update the DB.
 * Used when the existing key is expired/rejected.
 */
async function refreshAgentAccessKey(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const doToken = getDoToken();
  const newKey = await createAgentAccessKey(agent.agentUuid, doToken);
  await prisma.agent.update({
    where: { id: agentId },
    data: { agentAccessKey: newKey },
  });
  console.log(`[refreshAgentAccessKey] Refreshed access key for agent ${agentId}`);
  return newKey;
}

// ─── Agent update/delete ────────────────────────────────

/**
 * Update an agent on DO (uses PUT since PATCH returns 405).
 */
export async function updateDoAgent(
  agentUuid: string,
  updates: { name?: string; instruction?: string },
) {
  const doToken = getDoToken();

  const getRes = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
    headers: { Authorization: `Bearer ${doToken}` },
  });
  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`Failed to fetch DO agent: ${getRes.status} ${text}`);
  }

  const getData = await getRes.json();
  const current = getData.agent;
  if (!current) throw new Error("No agent data returned from DO");

  const safeName = (updates.name || current.name || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const putBody: Record<string, unknown> = {
    name: safeName,
    model_uuid: current.model?.uuid || process.env.DO_AGENT_MODEL_UUID,
    instruction: updates.instruction ?? current.instruction,
    description: current.description,
    region: current.region || process.env.DO_AGENT_REGION || "tor1",
    project_id: current.project_id || process.env.DO_PROJECT_ID,
  };

  if (current.knowledge_bases?.length > 0) {
    putBody.knowledge_base_uuid = current.knowledge_bases.map(
      (kb: { uuid: string }) => kb.uuid,
    );
  }

  const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(putBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update DO agent: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Toggle agent visibility on DO and update the DB.
 * Uses the dedicated /deployment_visibility endpoint.
 */
export async function updateAgentVisibility(agentId: string, isPublic: boolean) {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });

  if (agent.status === "active" && agent.agentUuid) {
    const doToken = getDoToken();
    const visibility = isPublic ? "VISIBILITY_PUBLIC" : "VISIBILITY_PRIVATE";

    const res = await fetch(
      `${DO_API_BASE}/agents/${agent.agentUuid}/deployment_visibility`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${doToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uuid: agent.agentUuid, visibility }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update agent visibility: ${res.status} ${text}`);
    }
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: { isPublic },
  });
}

/**
 * Delete an agent from DO (agent + workspace). KBs are NOT deleted (owned by knowledge bases).
 */
export async function deleteDoAgent(agent: {
  agentUuid: string;
  workspaceUuid: string;
}) {
  const doToken = getDoToken();

  await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch(() => {});

  if (agent.workspaceUuid) {
    await fetch(`${DO_API_BASE}/workspaces/${agent.workspaceUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    }).catch(() => {});
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
      // Map "support" (human operator) to "assistant" for the DO agent API
      role: m.role === "support" ? "assistant" : m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const callAgent = async (accessKey: string) => {
    const res = await fetch(`${agent.agentEndpoint}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        stream: false,
        include_retrieval_info: true,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    return res;
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
 * Lightweight health check: ping the agent endpoint with a short timeout.
 * Returns true if the endpoint responds (any HTTP status means reachable).
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
 * Idempotent — skips if recovery is already in progress for this agent.
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
