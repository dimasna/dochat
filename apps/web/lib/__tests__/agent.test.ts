import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("@dochat/db", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    knowledgeBase: { findMany: vi.fn() },
    agentKnowledgeBase: { createMany: vi.fn() },
    message: { findMany: vi.fn() },
    conversation: { update: vi.fn() },
  },
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock("@dochat/shared", () => ({
  SUPPORT_AGENT_PROMPT: "You are a support agent.",
}));

import { prisma } from "@dochat/db";
import {
  provisionAgent,
  tryFinalizeAgent,
  getAgent,
  generateAgentResponse,
  updateDoAgent,
  deleteDoAgent,
} from "../agent";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DIGITALOCEAN_API_TOKEN = "test-token";
  process.env.DO_AGENT_MODEL_UUID = "model-uuid";
  process.env.DO_AGENT_REGION = "tor1";
  process.env.DO_PROJECT_ID = "project-id";
});

describe("provisionAgent", () => {
  it("sanitizes agent name: special chars become dashes, lowercased", async () => {
    vi.mocked(prisma.agent.create).mockResolvedValue({
      id: "agent-1",
      orgId: "org-1",
      agentUuid: "uuid-1",
      agentEndpoint: "",
      agentAccessKey: "",
      workspaceUuid: "",
      name: "My Agent!",
      description: null,
      instruction: "You are a support agent.",
      isPublic: false,
      voiceId: null,
      status: "provisioning",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock agent creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: { uuid: "uuid-1" } }),
    });
    // Mock workspace creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: { uuid: "ws-1" } }),
    });

    await provisionAgent("org-1", "My Agent!");

    // Verify the agent creation call used sanitized name
    const createCall = mockFetch.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.name).toBe("my-agent-");
  });

  it("collects only ready KB UUIDs", async () => {
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      { id: "kb-1", gradientKbUuid: "do-kb-1", indexingStatus: "ready" } as never,
      { id: "kb-2", gradientKbUuid: null, indexingStatus: "ready" } as never,
    ]);
    vi.mocked(prisma.agent.create).mockResolvedValue({
      id: "agent-1", orgId: "org-1", agentUuid: "uuid-1",
      agentEndpoint: "", agentAccessKey: "", workspaceUuid: "",
      name: "Test", description: null, instruction: "", isPublic: false,
      status: "provisioning", createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(prisma.agentKnowledgeBase.createMany).mockResolvedValue({ count: 2 });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: { uuid: "uuid-1" } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: { uuid: "ws-1" } }),
    });

    await provisionAgent("org-1", "Test", undefined, ["kb-1", "kb-2"]);

    const createCall = mockFetch.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    // Only kb-1 has a non-null gradientKbUuid
    expect(body.knowledge_base_uuid).toEqual(["do-kb-1"]);
  });

  it("throws when DO API token is missing", async () => {
    delete process.env.DIGITALOCEAN_API_TOKEN;
    await expect(provisionAgent("org-1", "Test")).rejects.toThrow(
      "DIGITALOCEAN_API_TOKEN not configured",
    );
  });

  it("throws when agent creation fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(provisionAgent("org-1", "Test")).rejects.toThrow(
      "Failed to create agent: 500",
    );
  });
});

describe("tryFinalizeAgent", () => {
  it("returns false when agent is not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    expect(await tryFinalizeAgent("non-existent")).toBe(false);
  });

  it("returns false when agent is not provisioning", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active", agentUuid: "uuid-1", orgId: "org-1",
    } as never);
    expect(await tryFinalizeAgent("a1")).toBe(false);
  });

  it("finalizes agent when deployment URL is available", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "provisioning", agentUuid: "uuid-1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.agent.update).mockResolvedValue({} as never);

    // GET agent → has deployment URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agent: { deployment: { url: "https://agent.do.com" } },
      }),
    });
    // POST access key
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ api_key_info: { secret_key: "sk-123" } }),
    });

    const result = await tryFinalizeAgent("a1");
    expect(result).toBe(true);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: {
        agentEndpoint: "https://agent.do.com",
        agentAccessKey: "sk-123",
        status: "active",
      },
    });
  });

  it("returns false when deployment URL is not yet available", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "provisioning", agentUuid: "uuid-1", orgId: "org-1",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: { deployment: {} } }),
    });

    expect(await tryFinalizeAgent("a1")).toBe(false);
  });
});

describe("getAgent", () => {
  it("returns endpoint info for active agents", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active",
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    } as never);

    const info = await getAgent("a1");
    expect(info).toEqual({
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    });
  });

  it("throws when agent is not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    await expect(getAgent("missing")).rejects.toThrow("Agent missing not found");
  });

  it("throws when agent is in failed status", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "failed",
    } as never);
    await expect(getAgent("a1")).rejects.toThrow("Agent a1 is in status: failed");
  });
});

describe("generateAgentResponse", () => {
  it("maps 'support' role to 'assistant' in message history", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active",
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      { role: "user", content: "Hello", createdAt: new Date() },
      { role: "support", content: "Hi there!", createdAt: new Date() },
    ] as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "How can I help?" } }],
      }),
    });

    await generateAgentResponse("conv-1", "a1", "I need help");

    const chatCall = mockFetch.mock.calls[0];
    const body = JSON.parse(chatCall[1].body);
    expect(body.messages[1].role).toBe("assistant"); // "support" → "assistant"
  });

  it("detects and processes escalation pattern", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active",
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "I'll connect you with a human agent. [ESCALATE: customer wants human support]",
          },
        }],
      }),
    });

    const result = await generateAgentResponse("conv-1", "a1", "I want a real person");

    expect(result.content).toBe("I'll connect you with a human agent.");
    expect(result.toolCalls).toEqual([
      { name: "escalate_conversation", result: "Escalated: customer wants human support" },
    ]);
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { status: "escalated" },
    });
  });

  it("detects and processes resolution pattern", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active",
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "Glad I could help! [RESOLVE: issue addressed]",
          },
        }],
      }),
    });

    const result = await generateAgentResponse("conv-1", "a1", "Thanks!");

    expect(result.content).toBe("Glad I could help!");
    expect(result.toolCalls).toEqual([
      { name: "resolve_conversation", result: "Resolved: issue addressed" },
    ]);
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { status: "resolved" },
    });
  });

  it("passes through content without patterns unchanged", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", status: "active",
      agentEndpoint: "https://agent.do.com",
      agentAccessKey: "sk-123",
    } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Here is your answer." } }],
      }),
    });

    const result = await generateAgentResponse("conv-1", "a1", "question");

    expect(result.content).toBe("Here is your answer.");
    expect(result.toolCalls).toBeUndefined();
  });
});

describe("updateDoAgent", () => {
  it("uses PUT with merged current state", async () => {
    // GET current agent
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agent: {
          name: "old-name",
          model: { uuid: "model-uuid" },
          instruction: "old instruction",
          description: "desc",
          region: "tor1",
          project_id: "project-id",
          knowledge_bases: [],
        },
      }),
    });
    // PUT update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: {} }),
    });

    await updateDoAgent("uuid-1", { name: "New Name" });

    const putCall = mockFetch.mock.calls[1];
    expect(putCall[1].method).toBe("PUT");
    const body = JSON.parse(putCall[1].body);
    expect(body.name).toBe("new-name"); // sanitized
    expect(body.instruction).toBe("old instruction"); // preserved
  });
});

describe("deleteDoAgent", () => {
  it("deletes both agent and workspace", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await deleteDoAgent({ agentUuid: "uuid-1", workspaceUuid: "ws-1" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("/agents/uuid-1");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    expect(mockFetch.mock.calls[1][0]).toContain("/workspaces/ws-1");
  });

  it("skips workspace deletion when workspaceUuid is empty", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await deleteDoAgent({ agentUuid: "uuid-1", workspaceUuid: "" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
