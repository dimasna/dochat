import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    knowledgeBase: { findMany: vi.fn(), findUnique: vi.fn() },
    agentKnowledgeBase: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn((err: unknown) => {
    if (err && typeof err === "object" && "status" in err) return (err as { status: number }).status;
    return 500;
  }),
}));

vi.mock("@/lib/agent", () => ({
  syncAgentKbs: vi.fn(),
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { syncAgentKbs } from "@/lib/agent";
import { GET, POST, DELETE } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
  vi.mocked(syncAgentKbs).mockResolvedValue(undefined);
});

const mockParams = { params: Promise.resolve({ id: "agent-1" }) };

// ─── GET ────────────────────────────────────────────────

describe("GET /api/agents/:id/knowledge-bases", () => {
  it("returns agent KBs for authenticated org", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findMany).mockResolvedValue([
      {
        id: "akb-1", agentId: "agent-1", knowledgeBaseId: "kb-1",
        knowledgeBase: { id: "kb-1", name: "Docs", sources: [] },
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases");
    const res = await GET(req, mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].knowledgeBase.name).toBe("Docs");
  });

  it("returns 404 when agent not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases");
    const res = await GET(req, mockParams);

    expect(res.status).toBe(404);
  });

  it("returns 404 when agent belongs to different org", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-other",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases");
    const res = await GET(req, mockParams);

    expect(res.status).toBe(404);
  });
});

// ─── POST ───────────────────────────────────────────────

describe("POST /api/agents/:id/knowledge-bases", () => {
  it("attaches KBs to agent", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", agentUuid: "do-agent-uuid", status: "ready",
    } as never);
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      { id: "kb-1", orgId: "org-1", indexingStatus: "ready", gradientKbUuid: "do-kb-1" },
    ] as never);
    vi.mocked(prisma.agentKnowledgeBase.findMany).mockResolvedValue([
      { knowledgeBase: { gradientKbUuid: "do-kb-1" } },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseIds: ["kb-1"] }),
    });
    const res = await POST(req, mockParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(prisma.agentKnowledgeBase.createMany).toHaveBeenCalledWith({
      data: [{ agentId: "agent-1", knowledgeBaseId: "kb-1" }],
      skipDuplicates: true,
    });
  });

  it("calls syncAgentKbs with ALL KB UUIDs", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", agentUuid: "do-agent-uuid", status: "ready",
    } as never);
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      { id: "kb-2", orgId: "org-1", indexingStatus: "ready", gradientKbUuid: "do-kb-2" },
    ] as never);
    // Returns ALL KBs for agent (existing + new)
    vi.mocked(prisma.agentKnowledgeBase.findMany).mockResolvedValue([
      { knowledgeBase: { gradientKbUuid: "do-kb-1" } },
      { knowledgeBase: { gradientKbUuid: "do-kb-2" } },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseIds: ["kb-2"] }),
    });
    await POST(req, mockParams);

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 10));
    expect(syncAgentKbs).toHaveBeenCalledWith("agent-1", ["do-kb-1", "do-kb-2"]);
  });

  it("returns 400 when agent is provisioning", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", status: "provisioning",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseIds: ["kb-1"] }),
    });
    const res = await POST(req, mockParams);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("provisioning");
  });

  it("returns 400 when knowledgeBaseIds is missing", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", status: "ready",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, mockParams);

    expect(res.status).toBe(400);
  });

  it("returns 400 when some KBs are not ready", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", status: "ready",
    } as never);
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      { id: "kb-1", orgId: "org-1", indexingStatus: "ready", gradientKbUuid: "do-kb-1" },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseIds: ["kb-1", "kb-2"] }),
    });
    const res = await POST(req, mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("not ready");
  });
});

// ─── DELETE ─────────────────────────────────────────────

describe("DELETE /api/agents/:id/knowledge-bases", () => {
  it("detaches a KB and syncs agent", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", agentUuid: "do-agent-uuid",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findUnique).mockResolvedValue({
      id: "akb-1", agentId: "agent-1", knowledgeBaseId: "kb-1",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findMany).mockResolvedValue([
      { knowledgeBase: { gradientKbUuid: "do-kb-2" } },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "DELETE",
      body: JSON.stringify({ knowledgeBaseId: "kb-1" }),
    });
    const res = await DELETE(req, mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.agentKnowledgeBase.delete).toHaveBeenCalledWith({
      where: { id: "akb-1" },
    });
  });

  it("calls syncAgentKbs with remaining KB UUIDs", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1", agentUuid: "do-agent-uuid",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findUnique).mockResolvedValue({
      id: "akb-1", agentId: "agent-1", knowledgeBaseId: "kb-1",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findMany).mockResolvedValue([
      { knowledgeBase: { gradientKbUuid: "do-kb-2" } },
    ] as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "DELETE",
      body: JSON.stringify({ knowledgeBaseId: "kb-1" }),
    });
    await DELETE(req, mockParams);

    await new Promise((r) => setTimeout(r, 10));
    expect(syncAgentKbs).toHaveBeenCalledWith("agent-1", ["do-kb-2"]);
  });

  it("returns 404 when KB is not attached to agent", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.agentKnowledgeBase.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "DELETE",
      body: JSON.stringify({ knowledgeBaseId: "kb-1" }),
    });
    const res = await DELETE(req, mockParams);

    expect(res.status).toBe(404);
  });

  it("returns 400 when knowledgeBaseId is missing", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1", orgId: "org-1",
    } as never);

    const req = new NextRequest("http://localhost/api/agents/agent-1/knowledge-bases", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await DELETE(req, mockParams);

    expect(res.status).toBe(400);
  });
});
