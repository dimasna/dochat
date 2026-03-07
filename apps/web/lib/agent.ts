import { prisma } from "@dochat/db";
import { SUPPORT_AGENT_PROMPT } from "@dochat/shared";
import {
  createKnowledgeBase,
  buildDatasource,
  addDataSourceToKb,
  addWebCrawlerToKb,
  triggerIndexing,
  deleteKnowledgeBase,
} from "@/lib/knowledge-base";

const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

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
 * Always creates agent first (without KB) since DO KB provisioning takes ~7min.
 * If documentIds provided, KB creation + indexing + agent re-link happen async.
 * Returns immediately with status "provisioning".
 */
export async function provisionAgent(
  orgId: string,
  name: string,
  instruction?: string,
  documentIds?: string[],
) {
  const doToken = getDoToken();

  // Sanitize name for DO API (alphanumeric, hyphens, underscores only)
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").toLowerCase();

  const modelUuid = process.env.DO_AGENT_MODEL_UUID;
  if (!modelUuid) throw new Error("DO_AGENT_MODEL_UUID not configured");

  const agentInstruction = instruction || SUPPORT_AGENT_PROMPT;

  // 1. Create agent WITHOUT KB (KB provisioning takes ~7min, so we do it async)
  const agentRes = await fetch(`${DO_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeName,
      model_uuid: modelUuid,
      instruction: agentInstruction,
      description: `Dochat agent: ${name}`,
      region: process.env.DO_AGENT_REGION || "tor1",
      project_id: process.env.DO_PROJECT_ID,
    }),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    throw new Error(`Failed to create agent: ${agentRes.status} ${text}`);
  }

  const agentData = await agentRes.json();
  const agentUuid = agentData.agent?.uuid;
  if (!agentUuid) throw new Error("No UUID returned from agent creation");

  // 2. Create workspace for this agent
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
    } else {
      console.warn(`[agent] Workspace creation failed: ${wsRes.status} — continuing without workspace`);
    }
  } catch (err) {
    console.warn("[agent] Workspace creation error:", err);
  }

  // 3. Save to DB
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

  // 4. If docs provided, handle KB creation + indexing + agent re-link async
  if (documentIds && documentIds.length > 0) {
    indexDocsIntoAgent(agent.id, documentIds).catch((err) =>
      console.error("[agent] Failed to index docs:", err),
    );
  }

  return agent;
}

/**
 * Index org-level documents into an agent's KB.
 * If no KB exists yet: creates KB → waits for DB provisioning (~7min) →
 * indexes docs → waits for indexing → recreates DO agent with KB attached.
 * (DO API only links KBs at agent creation time, and requires KB to be indexed first.)
 */
export async function indexDocsIntoAgent(
  agentId: string,
  documentIds: string[],
) {
  let agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  let gradientKbUuid = agent.gradientKbUuid;

  const docs = await prisma.knowledgeDocument.findMany({
    where: { id: { in: documentIds } },
  });

  if (docs.length === 0) return;

  // If no KB exists yet, create it and go through the full provisioning flow
  if (!gradientKbUuid) {
    // Find the first doc that has indexable content
    let firstDatasource = null;
    let firstDocIndex = -1;
    for (let i = 0; i < docs.length; i++) {
      const ds = buildDatasource(docs[i]!);
      if (ds) {
        firstDocIndex = i;
        firstDatasource = ds;
        break;
      }
    }

    if (firstDocIndex === -1 || !firstDatasource) {
      console.error("[indexDocsIntoAgent] No indexable documents found");
      return;
    }

    const firstDoc = docs[firstDocIndex]!;

    // Create KB with the first datasource
    const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").toLowerCase();
    const { kbUuid, datasourceUuids } = await createKnowledgeBase(
      `${safeName}-kb`,
      [firstDatasource],
    );
    gradientKbUuid = kbUuid;

    // Save KB UUID to DB immediately
    await prisma.agent.update({
      where: { id: agentId },
      data: { gradientKbUuid },
    });

    console.log(`[indexDocsIntoAgent] KB created: ${kbUuid}, waiting for DB provisioning...`);

    // Wait for KB's internal database to be provisioned (~7 min)
    if (datasourceUuids.length > 0) {
      await waitForKbReady(kbUuid, datasourceUuids);
    }

    // Record the first doc
    const firstSourceId = datasourceUuids[0] || null;
    await upsertAgentDocument(agentId, firstDoc.id, firstSourceId);

    // Add remaining docs' datasources to the now-ready KB
    const remainingDocs = docs.filter((_, i) => i !== firstDocIndex);
    for (const doc of remainingDocs) {
      await addDocToKb(agentId, gradientKbUuid, doc);
    }

    // Wait for all indexing to complete before recreating agent
    await waitForKbIndexingComplete(kbUuid);

    // Recreate the DO agent with KB attached
    const { agentUuid: newAgentUuid, workspaceUuid: newWorkspaceUuid } =
      await recreateDoAgentWithKb(agent, gradientKbUuid);

    // Update DB with new agent identity
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        agentUuid: newAgentUuid,
        workspaceUuid: newWorkspaceUuid,
        agentEndpoint: "",
        agentAccessKey: "",
        status: "provisioning",
      },
    });

    console.log(`[indexDocsIntoAgent] Agent recreated with KB: ${newAgentUuid}`);
    return;
  }

  // KB already exists — just add datasources (this works without agent recreation)
  // But we still need to wait for KB to be ready before adding datasources
  for (const doc of docs) {
    await addDocToKb(agentId, gradientKbUuid, doc);
  }
}

/**
 * Wait for a KB's internal database to be provisioned by polling triggerIndexing.
 * DO returns "failed to get db creds" while the DB is still being set up.
 */
async function waitForKbReady(
  kbUuid: string,
  datasourceUuids: string[],
  maxAttempts = 120,
  intervalMs = 5000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await triggerIndexing(kbUuid, datasourceUuids);
      console.log(`[waitForKbReady] KB ${kbUuid} is ready after ${i * intervalMs / 1000}s`);
      return;
    } catch {
      // triggerIndexing logs errors internally; we just retry
    }

    // Also check via GET if indexing has started
    const doToken = getDoToken();
    const res = await fetch(`${DO_API_BASE}/knowledge_bases/${kbUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.knowledge_base?.last_indexing_job) {
        console.log(`[waitForKbReady] KB ${kbUuid} has indexing job, ready!`);
        return;
      }
    }

    if (i % 12 === 0) {
      console.log(`[waitForKbReady] Waiting for KB DB... attempt=${i + 1}/${maxAttempts}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.warn(`[waitForKbReady] KB ${kbUuid} did not become ready within ${maxAttempts * intervalMs / 1000}s — proceeding anyway`);
}

/**
 * Wait for all indexing jobs on a KB to complete.
 */
async function waitForKbIndexingComplete(
  kbUuid: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<void> {
  const doToken = getDoToken();

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${DO_API_BASE}/knowledge_bases/${kbUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      const job = data.knowledge_base?.last_indexing_job;
      if (job) {
        const phase = job.phase as string;
        if (phase.includes("SUCCEEDED") || phase.includes("FAILED") || phase.includes("COMPLETED")) {
          console.log(`[waitForKbIndexingComplete] KB ${kbUuid} indexing finished: ${phase}`);
          return;
        }
      }
    }

    if (i % 6 === 0) {
      console.log(`[waitForKbIndexingComplete] Waiting for indexing... attempt=${i + 1}/${maxAttempts}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.warn(`[waitForKbIndexingComplete] KB ${kbUuid} indexing did not complete within ${maxAttempts * intervalMs / 1000}s — proceeding anyway`);
}

/**
 * Add a single document's datasource to an existing KB and record it.
 */
async function addDocToKb(
  agentId: string,
  kbUuid: string,
  doc: { id: string; sourceType: string; sourceUrl: string | null; spacesKey: string | null },
): Promise<void> {
  try {
    let sourceId: string | null = null;

    if (doc.sourceType === "website" && doc.sourceUrl) {
      sourceId = await addWebCrawlerToKb(kbUuid, doc.sourceUrl);
    } else if (doc.spacesKey) {
      sourceId = await addDataSourceToKb(kbUuid, doc.spacesKey);
    }

    if (sourceId) {
      await triggerIndexing(kbUuid, [sourceId]);
    }

    await upsertAgentDocument(agentId, doc.id, sourceId);
  } catch (err) {
    console.error(`[addDocToKb] Failed for doc ${doc.id}:`, err);
    await upsertAgentDocument(agentId, doc.id, null, "failed");
  }
}

async function upsertAgentDocument(
  agentId: string,
  docId: string,
  sourceId: string | null,
  forceStatus?: string,
): Promise<void> {
  const status = forceStatus || (sourceId ? "indexed" : "failed");
  await prisma.agentDocument.upsert({
    where: {
      agentId_knowledgeDocumentId: {
        agentId,
        knowledgeDocumentId: docId,
      },
    },
    update: { gradientSourceId: sourceId, status },
    create: {
      agentId,
      knowledgeDocumentId: docId,
      gradientSourceId: sourceId,
      status,
    },
  });
}

/**
 * Delete the existing DO agent and recreate it with a KB attached.
 * Returns the new agent UUID and workspace UUID.
 */
async function recreateDoAgentWithKb(
  agent: { agentUuid: string; workspaceUuid: string; name: string; instruction: string | null },
  kbUuid: string,
): Promise<{ agentUuid: string; workspaceUuid: string }> {
  const doToken = getDoToken();
  const modelUuid = process.env.DO_AGENT_MODEL_UUID;
  if (!modelUuid) throw new Error("DO_AGENT_MODEL_UUID not configured");

  const safeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").toLowerCase();

  // Delete old agent (best-effort)
  await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch(() => {});

  // Delete old workspace (best-effort)
  if (agent.workspaceUuid) {
    await fetch(`${DO_API_BASE}/workspaces/${agent.workspaceUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    }).catch(() => {});
  }

  // Create new agent with KB attached
  const agentRes = await fetch(`${DO_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeName,
      model_uuid: modelUuid,
      instruction: agent.instruction || SUPPORT_AGENT_PROMPT,
      description: `Dochat agent: ${agent.name}`,
      region: process.env.DO_AGENT_REGION || "tor1",
      project_id: process.env.DO_PROJECT_ID,
      knowledge_base_uuid: [kbUuid],
    }),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    throw new Error(`Failed to recreate agent with KB: ${agentRes.status} ${text}`);
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
    console.warn("[recreateDoAgentWithKb] Workspace creation failed");
  }

  console.log(`[recreateDoAgentWithKb] Recreated agent ${newAgentUuid} with KB ${kbUuid}`);
  return { agentUuid: newAgentUuid, workspaceUuid };
}

/**
 * Non-blocking check: if the DO agent is deployed, finalize it (set endpoint, access key, status=active).
 * Called from the GET endpoint during UI polling so the status transitions automatically.
 * Returns true if the agent was finalized.
 */
export async function tryFinalizeAgent(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status !== "provisioning") return false;

  const doToken = getDoToken();

  try {
    const res = await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });

    if (!res.ok) return false;

    const data = await res.json();
    const deploymentUrl = data.agent?.deployment?.url;
    if (!deploymentUrl) return false;

    // Agent is deployed — create access key and activate
    const accessKey = await createAgentAccessKey(agent.agentUuid, doToken);

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        agentEndpoint: deploymentUrl,
        agentAccessKey: accessKey,
        status: "active",
      },
    });

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

  if (agent.status === "active") {
    return {
      agentEndpoint: agent.agentEndpoint,
      agentAccessKey: agent.agentAccessKey,
    };
  }

  if (agent.status === "provisioning") {
    return finalizeAgent(agent.id, agent.agentUuid);
  }

  throw new Error(`Agent ${agentId} is in status: ${agent.status}`);
}

/**
 * Wait for a provisioning agent to finish deploying, then activate it.
 */
async function finalizeAgent(
  agentId: string,
  agentUuid: string,
): Promise<AgentInfo> {
  const doToken = getDoToken();

  const deploymentUrl = await waitForAgentDeployment(agentUuid, doToken);
  const accessKey = await createAgentAccessKey(agentUuid, doToken);

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      agentEndpoint: deploymentUrl,
      agentAccessKey: accessKey,
      status: "active",
    },
  });

  return { agentEndpoint: deploymentUrl, agentAccessKey: accessKey };
}

async function waitForAgentDeployment(
  agentUuid: string,
  doToken: string,
  maxAttempts = 90,
  intervalMs = 3000,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
      headers: { Authorization: `Bearer ${doToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      const url = data.agent?.deployment?.url;
      if (url) return url;

      const status = data.agent?.deployment?.status;
      if (i % 10 === 0) {
        console.log(`[agent] Waiting for deployment... status=${status} attempt=${i + 1}/${maxAttempts}`);
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Agent ${agentUuid} did not deploy within ${maxAttempts * intervalMs / 1000}s`);
}

async function createAgentAccessKey(
  agentUuid: string,
  doToken: string,
): Promise<string> {
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
 * Update an agent on DO (uses PUT with full body since PATCH returns 405).
 * Fetches current agent state, merges updates, then PUTs back.
 */
export async function updateDoAgent(
  agentUuid: string,
  updates: { name?: string; instruction?: string },
) {
  const doToken = getDoToken();

  // GET current agent state
  const getRes = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
    headers: { Authorization: `Bearer ${doToken}` },
  });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`Failed to fetch DO agent for update: ${getRes.status} ${text}`);
  }

  const getData = await getRes.json();
  const current = getData.agent;
  if (!current) throw new Error("No agent data returned from DO");

  // Build full PUT body with merged updates
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

  // Preserve existing KB attachment
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

export async function deleteDoAgent(agent: {
  agentUuid: string;
  workspaceUuid: string;
  gradientKbUuid: string | null;
}) {
  const doToken = getDoToken();

  // Delete agent first
  const agentRes = await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch((err) => { console.error("[deleteDoAgent] Agent delete network error:", err); return null; });
  if (agentRes && !agentRes.ok) {
    const text = await agentRes.text();
    console.error(`[deleteDoAgent] Agent delete failed: ${agentRes.status} ${text}`);
  }

  // Then delete workspace
  if (agent.workspaceUuid) {
    const wsRes = await fetch(`${DO_API_BASE}/workspaces/${agent.workspaceUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    }).catch((err) => { console.error("[deleteDoAgent] Workspace delete network error:", err); return null; });
    if (wsRes && !wsRes.ok) {
      const text = await wsRes.text();
      console.error(`[deleteDoAgent] Workspace delete failed: ${wsRes.status} ${text}`);
    }
  }

  // Delete KB
  if (agent.gradientKbUuid) {
    await deleteKnowledgeBase(agent.gradientKbUuid);
  }
}

// ─── Chat with agent ────────────────────────────────────

async function callDoAgent(
  agentEndpoint: string,
  accessKey: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch(`${agentEndpoint}/api/v1/chat/completions`, {
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
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agent API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
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
    toolCalls.push({
      name: "escalate_conversation",
      result: `Escalated: ${escalateMatch[1]}`,
    });
    cleanContent = cleanContent.replace(ESCALATE_PATTERN, "").trim();
  }

  const resolveMatch = content.match(RESOLVE_PATTERN);
  if (resolveMatch) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "resolved" },
    });
    toolCalls.push({
      name: "resolve_conversation",
      result: `Resolved: ${resolveMatch[1]}`,
    });
    cleanContent = cleanContent.replace(RESOLVE_PATTERN, "").trim();
  }

  return {
    content: cleanContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ─── Main entry point ───────────────────────────────────

/**
 * Generate a response from a specific agent.
 * Signature uses agentId (not orgId) to support multi-agent.
 */
export async function generateAgentResponse(
  conversationId: string,
  agentId: string,
  userMessage: string,
): Promise<{ content: string; toolCalls?: Array<{ name: string; result: string }> }> {
  const agent = await getAgent(agentId);

  // Load conversation history
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];


  const responseContent = await callDoAgent(
    agent.agentEndpoint,
    agent.agentAccessKey,
    messages,
  );

  return postProcessResponse(conversationId, responseContent);
}
