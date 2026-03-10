import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    contactSession: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/agent", () => ({
  generateAgentResponse: vi.fn(),
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock("@/lib/limits", () => ({
  checkMessageCreditLimit: vi.fn(),
  LimitError: class LimitError extends Error {
    status = 403;
    constructor(message: string) {
      super(message);
    }
  },
}));

import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";
import { eventBus } from "@/lib/event-bus";
import { checkMessageCreditLimit } from "@/lib/limits";
import { POST, OPTIONS } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/embed/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("OPTIONS /api/embed/chat", () => {
  it("returns 204 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});

describe("POST /api/embed/chat", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ content: "Hi" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("required");
  });

  it("returns 401 for invalid session token", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "invalid", content: "Hi",
    }));

    expect(res.status).toBe(401);
  });

  it("returns 401 for expired session", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() - 1000), // expired
    } as never);

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hi",
    }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid or expired session");
  });

  it("returns 404 when conversation not found", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({
      conversationId: "missing", sessionToken: "tok", content: "Hi",
    }));

    expect(res.status).toBe(404);
  });

  it("returns 404 when conversation belongs to different session", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s2", // different session
    } as never);

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hi",
    }));

    expect(res.status).toBe(404);
  });

  it("generates AI response for unresolved conversation with active subscription", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s1", agentId: "a1", orgId: "org-1",
      status: "unresolved",
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: "active",
    } as never);
    vi.mocked(checkMessageCreditLimit).mockResolvedValue(undefined);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce({
        id: "m1", role: "user", content: "Hello", createdAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        id: "m2", role: "assistant", content: "Hi there!", createdAt: new Date(),
      } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(generateAgentResponse).mockResolvedValue({ content: "Hi there!" });

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hello",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userMessage.role).toBe("user");
    expect(body.assistantMessage.role).toBe("assistant");
    expect(eventBus.emit).toHaveBeenCalledTimes(2); // user + assistant messages
  });

  it("skips AI response for escalated conversation", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s1", agentId: "a1", orgId: "org-1",
      status: "escalated",
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: "active",
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: "m1", role: "user", content: "Hello", createdAt: new Date(),
    } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hello",
    }));
    const body = await res.json();

    expect(body.assistantMessage).toBeNull();
    expect(generateAgentResponse).not.toHaveBeenCalled();
  });

  it("skips AI response when subscription is not active", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s1", agentId: "a1", orgId: "org-1",
      status: "unresolved",
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: "cancelled",
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: "m1", role: "user", content: "Hello", createdAt: new Date(),
    } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hello",
    }));
    const body = await res.json();

    expect(body.assistantMessage).toBeNull();
    expect(generateAgentResponse).not.toHaveBeenCalled();
  });

  it("returns fallback message when agent response fails", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s1", agentId: "a1", orgId: "org-1",
      status: "unresolved",
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: "active",
    } as never);
    vi.mocked(checkMessageCreditLimit).mockResolvedValue(undefined);
    vi.mocked(prisma.message.create)
      .mockResolvedValueOnce({ id: "m1", role: "user", createdAt: new Date() } as never)
      .mockResolvedValueOnce({
        id: "m2", role: "assistant",
        content: "I'm sorry, I'm having trouble right now. Would you like me to connect you with a human support agent?",
        createdAt: new Date(),
      } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(generateAgentResponse).mockRejectedValue(new Error("DO API down"));

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hello",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.assistantMessage.content).toContain("having trouble");
  });

  it("returns 403 when message credit limit reached", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({
      id: "s1", expiresAt: new Date(Date.now() + 60000),
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "c1", contactSessionId: "s1", agentId: "a1", orgId: "org-1",
      status: "unresolved",
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: "active",
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: "m1", role: "user", createdAt: new Date(),
    } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

    const { LimitError } = await import("@/lib/limits");
    vi.mocked(checkMessageCreditLimit).mockRejectedValue(
      new LimitError("Monthly message credit limit reached"),
    );

    const res = await POST(makeRequest({
      conversationId: "c1", sessionToken: "tok", content: "Hello",
    }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("credit limit");
  });
});
