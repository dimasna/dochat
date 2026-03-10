import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  Prisma: { DbNull: Symbol("DbNull") },
  prisma: {
    conversation: { findMany: vi.fn(), create: vi.fn() },
    contactSession: { findUnique: vi.fn() },
    agent: { findFirst: vi.fn() },
    widgetSettings: { findUnique: vi.fn() },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn().mockReturnValue(500),
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { GET, POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/conversations", () => {
  it("returns conversations for contactSessionId (public access)", async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      {
        id: "c1", status: "unresolved", updatedAt: new Date(),
        messages: [{ content: "Hello" }],
        contactSession: { name: "John", email: "j@t.com" },
        agent: { id: "a1", name: "Bot" },
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/conversations?contactSessionId=s1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    // Should NOT call getAuthUser for public access
    expect(getAuthUser).not.toHaveBeenCalled();
  });

  it("returns grouped conversations for authenticated dashboard", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      {
        id: "c1", status: "unresolved", updatedAt: new Date("2024-01-01"),
        contactSession: { id: "s1", name: "John", email: "j@t.com", metadata: { timezone: "UTC" } },
        agent: { id: "a1", name: "Bot" },
        messages: [],
      },
      {
        id: "c2", status: "resolved", updatedAt: new Date("2024-01-02"),
        contactSession: { id: "s1", name: "John", email: "j@t.com", metadata: { timezone: "UTC" } },
        agent: { id: "a1", name: "Bot" },
        messages: [],
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/conversations");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Should be grouped: 1 group with 2 conversations
    expect(body).toHaveLength(1);
    expect(body[0].conversationCount).toBe(2);
    expect(body[0].contactSession.name).toBe("John");
  });

  it("filters out playground sessions", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      {
        id: "c1", status: "unresolved", updatedAt: new Date(),
        contactSession: { id: "s1", name: "Real User", metadata: { timezone: "UTC" } },
        agent: { id: "a1", name: "Bot" },
        messages: [],
      },
      {
        id: "c2", status: "unresolved", updatedAt: new Date(),
        contactSession: { id: "s2", name: "Test", metadata: { isPlayground: true } },
        agent: { id: "a1", name: "Bot" },
        messages: [],
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/conversations");
    const res = await GET(req);
    const body = await res.json();

    // Only the real user conversation should remain
    expect(body).toHaveLength(1);
    expect(body[0].contactSession.name).toBe("Real User");
  });
});

describe("POST /api/conversations", () => {
  it("creates conversation with greeting message", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue({
      greetMessage: "Welcome! How can I help?",
    } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({
      id: "c1", status: "unresolved", agentId: "a1",
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({} as never);

    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", contactSessionId: "s1", agentId: "a1" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: "c1",
        role: "assistant",
        content: "Welcome! How can I help?",
      },
    });
  });

  it("falls back to first org agent when agentId not provided", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.agent.findFirst).mockResolvedValue({ id: "default-agent" } as never);
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.conversation.create).mockResolvedValue({
      id: "c1", agentId: "default-agent",
    } as never);

    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", contactSessionId: "s1" }),
    });

    await POST(req);

    expect(prisma.agent.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ agentId: "default-agent" }),
    });
  });

  it("returns 404 when no agent configured", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.agent.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", contactSessionId: "s1" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("No agent configured");
  });

  it("returns 400 when orgId missing", async () => {
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ contactSessionId: "s1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when contactSessionId missing", async () => {
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when contact session not found", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", contactSessionId: "missing" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("skips greeting when greetMessage is not set", async () => {
    vi.mocked(prisma.contactSession.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue({
      greetMessage: null,
    } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "c1" } as never);

    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", contactSessionId: "s1", agentId: "a1" }),
    });

    await POST(req);

    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
