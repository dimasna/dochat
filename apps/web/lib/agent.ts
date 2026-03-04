import { prisma } from "@dochat/db";
import { SUPPORT_AGENT_PROMPT } from "@dochat/shared";
import { getKnowledgeBaseUuid, searchKb } from "@/lib/knowledge-base";

const GRADIENT_API_URL = "https://cluster-api.do-ai.run/v1/chat/completions";

const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge_base",
      description:
        "Search the organization's knowledge base for relevant information to answer customer questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalate_conversation",
      description:
        "Escalate the conversation to a human agent when the AI cannot resolve the issue.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Reason for escalation" },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resolve_conversation",
      description:
        "Mark the conversation as resolved when the customer's issue is addressed.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resolution summary" },
        },
        required: ["summary"],
      },
    },
  },
];

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

async function searchKnowledgeBase(
  query: string,
  orgId: string,
): Promise<string> {
  try {
    const kbUuid = await getKnowledgeBaseUuid(orgId);
    if (!kbUuid) {
      return "Knowledge base is not configured for this organization.";
    }

    return await searchKb(kbUuid, query);
  } catch {
    return "Error searching knowledge base.";
  }
}

async function escalateConversation(
  conversationId: string,
  reason: string,
): Promise<string> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "escalated" },
  });
  return `Conversation escalated. Reason: ${reason}`;
}

async function resolveConversation(
  conversationId: string,
  summary: string,
): Promise<string> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "resolved" },
  });
  return `Conversation resolved. Summary: ${summary}`;
}

async function executeTool(
  toolCall: ToolCall,
  conversationId: string,
  orgId: string,
): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "search_knowledge_base":
      return searchKnowledgeBase(args.query, orgId);
    case "escalate_conversation":
      return escalateConversation(conversationId, args.reason);
    case "resolve_conversation":
      return resolveConversation(conversationId, args.summary);
    default:
      return `Unknown tool: ${toolCall.function.name}`;
  }
}

async function callGradientAPI(
  messages: Array<{ role: string; content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }>,
  includeTools = true,
) {
  const apiKey = process.env.GRADIENT_MODEL_ACCESS_KEY;
  if (!apiKey) throw new Error("GRADIENT_MODEL_ACCESS_KEY not configured");

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages,
  };

  if (includeTools) {
    body.tools = TOOL_DEFINITIONS;
    body.tool_choice = "auto";
  }

  const res = await fetch(GRADIENT_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gradient API error: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Generate a response from the AI agent for a conversation.
 * Handles the full tool-call loop.
 */
export async function generateAgentResponse(
  conversationId: string,
  orgId: string,
  userMessage: string,
): Promise<{ content: string; toolCalls?: Array<{ name: string; result: string }> }> {
  // Load conversation history
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20, // last 20 messages for context
  });

  const messages: Array<{ role: string; content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [
    { role: "system", content: SUPPORT_AGENT_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const result = await callGradientAPI(messages);
  const choice = result.choices[0];
  const toolCallResults: Array<{ name: string; result: string }> = [];

  // Handle tool calls (may need multiple rounds)
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    messages.push(choice.message);

    for (const tc of choice.message.tool_calls) {
      const toolResult = await executeTool(tc, conversationId, orgId);
      toolCallResults.push({ name: tc.function.name, result: toolResult });
      messages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: tc.id,
      });
    }

    // Get final response after tool execution
    const finalResult = await callGradientAPI(messages, false);
    return {
      content: finalResult.choices[0].message.content,
      toolCalls: toolCallResults,
    };
  }

  return { content: choice.message.content };
}
