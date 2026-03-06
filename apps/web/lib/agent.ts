import { prisma } from "@dochat/db";
import { SUPPORT_AGENT_PROMPT } from "@dochat/shared";
import {
  createKnowledgeBase,
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
 * Creates: KB → Agent → Workspace → saves to DB.
 * Does NOT wait for deployment — returns immediately with status "provisioning".
 */
export async function provisionAgent(
  orgId: string,
  name: string,
  instruction?: string,
  documentIds?: string[],
) {
  const doToken = getDoToken();

  // 1. Create knowledge base
  const gradientKbUuid = await createKnowledgeBase(`${name}-kb`);

  // 2. Create agent with KB attached
  const modelUuid = process.env.DO_AGENT_MODEL_UUID;
  if (!modelUuid) throw new Error("DO_AGENT_MODEL_UUID not configured");

  const agentRes = await fetch(`${DO_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      model_uuid: modelUuid,
      instruction: instruction || SUPPORT_AGENT_PROMPT,
      description: `Dochat agent: ${name}`,
      region: process.env.DO_AGENT_REGION || "tor1",
      project_id: process.env.DO_PROJECT_ID,
      knowledge_base_uuid: [gradientKbUuid],
    }),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    // Cleanup KB on failure
    await deleteKnowledgeBase(gradientKbUuid);
    throw new Error(`Failed to create agent: ${agentRes.status} ${text}`);
  }

  const agentData = await agentRes.json();
  const agentUuid = agentData.agent?.uuid;
  if (!agentUuid) throw new Error("No UUID returned from agent creation");

  // 3. Create workspace for this agent
  let workspaceUuid = "";
  try {
    const wsRes = await fetch(`${DO_API_BASE}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${name}-workspace`,
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

  // 4. Save to DB
  const agent = await prisma.agent.create({
    data: {
      orgId,
      agentUuid,
      agentEndpoint: "",
      agentAccessKey: "",
      workspaceUuid,
      gradientKbUuid,
      name,
      instruction: instruction || SUPPORT_AGENT_PROMPT,
      status: "provisioning",
    },
  });

  // 5. Index documents into agent's KB (fire-and-forget)
  if (documentIds && documentIds.length > 0) {
    indexDocsIntoAgent(agent.id, gradientKbUuid, documentIds).catch((err) =>
      console.error("[agent] Failed to index docs:", err),
    );
  }

  return agent;
}

/**
 * Index org-level documents into an agent's KB.
 * Creates AgentDocument records tracking each doc's status in this agent's KB.
 */
export async function indexDocsIntoAgent(
  agentId: string,
  gradientKbUuid: string,
  documentIds: string[],
) {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { id: { in: documentIds } },
  });

  for (const doc of docs) {
    try {
      let sourceId: string | null = null;

      if (doc.sourceType === "website" && doc.sourceUrl) {
        sourceId = await addWebCrawlerToKb(gradientKbUuid, doc.sourceUrl);
      } else if (doc.spacesKey) {
        sourceId = await addDataSourceToKb(gradientKbUuid, doc.spacesKey);
      }

      if (sourceId) {
        await triggerIndexing(gradientKbUuid, [sourceId]);
      }

      await prisma.agentDocument.upsert({
        where: {
          agentId_knowledgeDocumentId: {
            agentId,
            knowledgeDocumentId: doc.id,
          },
        },
        update: {
          gradientSourceId: sourceId,
          status: sourceId ? "indexed" : "failed",
        },
        create: {
          agentId,
          knowledgeDocumentId: doc.id,
          gradientSourceId: sourceId,
          status: sourceId ? "indexed" : "failed",
        },
      });
    } catch (err) {
      console.error(`[indexDocsIntoAgent] Failed for doc ${doc.id}:`, err);
      await prisma.agentDocument.upsert({
        where: {
          agentId_knowledgeDocumentId: {
            agentId,
            knowledgeDocumentId: doc.id,
          },
        },
        update: { status: "failed" },
        create: {
          agentId,
          knowledgeDocumentId: doc.id,
          status: "failed",
        },
      }).catch(() => {});
    }
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
  const key = data.api_key?.key;
  if (!key) throw new Error("No access key returned");
  return key;
}

/**
 * Delete an agent from DO (agent + workspace + KB).
 */
export async function updateDoAgent(
  agentUuid: string,
  updates: { name?: string; instruction?: string },
) {
  const doToken = getDoToken();

  const res = await fetch(`${DO_API_BASE}/agents/${agentUuid}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
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
  gradientKbUuid: string;
}) {
  const doToken = getDoToken();

  // Delete agent
  await fetch(`${DO_API_BASE}/agents/${agent.agentUuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${doToken}` },
  }).catch(() => {});

  // Delete workspace
  if (agent.workspaceUuid) {
    await fetch(`${DO_API_BASE}/workspaces/${agent.workspaceUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${doToken}` },
    }).catch(() => {});
  }

  // Delete KB
  await deleteKnowledgeBase(agent.gradientKbUuid);
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
