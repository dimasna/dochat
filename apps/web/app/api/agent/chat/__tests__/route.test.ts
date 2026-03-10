import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/agent", () => ({
  generateAgentResponse: vi.fn(),
}));

import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/agent/chat", () => {
  it("saves user message, generates response, saves assistant message", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "conv-1", agentId: "a1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce({ id: "msg-1", role: "user", content: "Hello" } as never)
      .mockResolvedValueOnce({ id: "msg-2", role: "assistant", content: "Hi there!" } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(generateAgentResponse).mockResolvedValue({
      content: "Hi there!",
    });

    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-1", content: "Hello" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userMessage.role).toBe("user");
    expect(body.assistantMessage.role).toBe("assistant");
    expect(body.assistantMessage.content).toBe("Hi there!");
  });

  it("saves tool calls in assistant message metadata", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "conv-1", agentId: "a1",
    } as never);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce({ id: "msg-1" } as never)
      .mockResolvedValueOnce({ id: "msg-2" } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(generateAgentResponse).mockResolvedValue({
      content: "Escalating...",
      toolCalls: [{ name: "escalate_conversation", result: "Escalated: user wants human" }],
    });

    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-1", content: "I want a human" }),
    });

    await POST(req);

    const secondCreateCall = vi.mocked(prisma.message.create).mock.calls[1][0];
    expect(secondCreateCall.data.metadata).toEqual({
      toolCalls: [{ name: "escalate_conversation", result: "Escalated: user wants human" }],
    });
  });

  it("returns 400 when conversationId is missing", async () => {
    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("conversationId and content required");
  });

  it("returns 400 when content is missing", async () => {
    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversation not found", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: "missing", content: "Hello" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Conversation not found");
  });

  it("returns 500 when agent response generation fails", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "conv-1", agentId: "a1",
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: "msg-1" } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(generateAgentResponse).mockRejectedValue(new Error("DO API down"));

    const req = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-1", content: "Hello" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
