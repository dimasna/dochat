import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    widgetSettings: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn().mockReturnValue(500),
}));

vi.mock("@/lib/agent", () => ({
  provisionAgent: vi.fn(),
  tryFinalizeAgent: vi.fn(),
}));

vi.mock("@/lib/limits", () => ({
  checkAgentLimit: vi.fn(),
  LimitError: class LimitError extends Error {
    status = 403;
    constructor(message: string) {
      super(message);
    }
  },
}));

import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { provisionAgent, tryFinalizeAgent } from "@/lib/agent";
import { checkAgentLimit, LimitError } from "@/lib/limits";
import { GET, POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/agents", () => {
  it("returns agents for authenticated org", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      {
        id: "a1", orgId: "org-1", name: "Agent 1", status: "active",
        _count: { conversations: 5, knowledgeBases: 2 },
      },
    ] as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Agent 1");
  });

  it("returns 400 when no orgId", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: undefined });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No organization");
  });

  it("triggers fire-and-forget finalization for provisioning agents", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      { id: "a1", status: "provisioning" },
      { id: "a2", status: "active" },
    ] as never);
    vi.mocked(tryFinalizeAgent).mockResolvedValue(true);

    await GET();

    // Wait for fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(tryFinalizeAgent).toHaveBeenCalledWith("a1");
    expect(tryFinalizeAgent).not.toHaveBeenCalledWith("a2");
  });
});

describe("POST /api/agents", () => {
  it("creates agent with 201 status", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkAgentLimit).mockResolvedValue(undefined);
    vi.mocked(provisionAgent).mockResolvedValue({
      id: "a1", orgId: "org-1", name: "New Agent", status: "provisioning",
    } as never);
    vi.mocked(prisma.widgetSettings.create).mockResolvedValue({} as never);

    const req = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: "New Agent" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("New Agent");
    expect(prisma.widgetSettings.create).toHaveBeenCalledWith({
      data: { agentId: "a1", orgId: "org-1" },
    });
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkAgentLimit).mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name is required");
  });

  it("updates description when provided", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkAgentLimit).mockResolvedValue(undefined);
    vi.mocked(provisionAgent).mockResolvedValue({ id: "a1" } as never);
    vi.mocked(prisma.agent.update).mockResolvedValue({} as never);
    vi.mocked(prisma.widgetSettings.create).mockResolvedValue({} as never);

    const req = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Agent", description: "My desc" }),
    });

    await POST(req);

    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { description: "My desc" },
    });
  });

  it("returns 400 when no orgId", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: undefined });

    const req = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns error when agent limit reached", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkAgentLimit).mockRejectedValue(new LimitError("Agent limit reached"));
    vi.mocked(getErrorStatus).mockReturnValue(403);

    const req = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Agent limit reached");
  });
});
