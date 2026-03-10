import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn().mockReturnValue(500),
}));

vi.mock("@/lib/agent", () => ({
  tryFinalizeAgent: vi.fn(),
  updateDoAgent: vi.fn(),
  deleteDoAgent: vi.fn(),
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { tryFinalizeAgent, updateDoAgent, deleteDoAgent } from "@/lib/agent";
import { GET, PATCH, DELETE } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/agents/[id]", () => {
  it("returns agent with widget settings and counts", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-1", name: "Agent", status: "active",
      widgetSettings: { greetMessage: "Hi!" },
      knowledgeBases: [],
      _count: { conversations: 3 },
    } as never);

    const req = new NextRequest("http://localhost/api/agents/a1");
    const res = await GET(req, makeParams("a1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Agent");
    expect(body.widgetSettings.greetMessage).toBe("Hi!");
  });

  it("returns 404 when agent not found", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/missing");
    const res = await GET(req, makeParams("missing"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Agent not found");
  });

  it("returns 404 when agent belongs to different org", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-2", name: "Agent", status: "active",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/a1");
    const res = await GET(req, makeParams("a1"));

    expect(res.status).toBe(404);
  });

  it("auto-finalizes provisioning agent and re-fetches", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique)
      .mockResolvedValueOnce({
        id: "a1", orgId: "org-1", status: "provisioning",
        widgetSettings: null, knowledgeBases: [], _count: { conversations: 0 },
      } as never)
      .mockResolvedValueOnce({
        id: "a1", orgId: "org-1", status: "active",
        agentEndpoint: "https://agent.do.com",
        widgetSettings: null, knowledgeBases: [], _count: { conversations: 0 },
      } as never);
    vi.mocked(tryFinalizeAgent).mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/agents/a1");
    const res = await GET(req, makeParams("a1"));
    const body = await res.json();

    expect(tryFinalizeAgent).toHaveBeenCalledWith("a1");
    expect(body.status).toBe("active");
  });
});

describe("PATCH /api/agents/[id]", () => {
  it("updates agent name and syncs to DO when active", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-1", status: "active", agentUuid: "do-uuid",
    } as never);
    vi.mocked(prisma.agent.update).mockResolvedValue({
      id: "a1", name: "Updated Name",
    } as never);
    vi.mocked(updateDoAgent).mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/agents/a1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
    });
    const res = await PATCH(req, makeParams("a1"));

    expect(updateDoAgent).toHaveBeenCalledWith("do-uuid", { name: "Updated Name" });
    expect(prisma.agent.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("skips DO sync when agent is still provisioning", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-1", status: "provisioning", agentUuid: "do-uuid",
    } as never);
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1" } as never);

    const req = new NextRequest("http://localhost/api/agents/a1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });
    await PATCH(req, makeParams("a1"));

    expect(updateDoAgent).not.toHaveBeenCalled();
  });

  it("returns 404 for agent from different org", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-2",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/a1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
    });
    const res = await PATCH(req, makeParams("a1"));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/agents/[id]", () => {
  it("deletes from DO and DB", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "a1", orgId: "org-1", agentUuid: "do-uuid", workspaceUuid: "ws-uuid",
    } as never);
    vi.mocked(deleteDoAgent).mockResolvedValue(undefined);
    vi.mocked(prisma.agent.delete).mockResolvedValue({} as never);

    const req = new NextRequest("http://localhost/api/agents/a1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("a1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteDoAgent).toHaveBeenCalledWith({
      agentUuid: "do-uuid", workspaceUuid: "ws-uuid",
    });
    expect(prisma.agent.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("returns 404 for non-existent agent", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/missing", { method: "DELETE" });
    const res = await DELETE(req, makeParams("missing"));

    expect(res.status).toBe(404);
  });
});
