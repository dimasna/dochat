import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    knowledgeBase: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn().mockReturnValue(500),
}));

vi.mock("@/lib/knowledge-base", () => ({
  reconcileStaleKbStatuses: vi.fn(),
}));

vi.mock("@/lib/limits", () => ({
  checkKbLimit: vi.fn(),
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { reconcileStaleKbStatuses } from "@/lib/knowledge-base";
import { checkKbLimit } from "@/lib/limits";
import { GET, POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/knowledge-bases", () => {
  it("returns KBs for authenticated org", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      { id: "kb1", name: "Docs KB", indexingStatus: "ready", sources: [], _count: { sources: 3 } },
    ] as never);

    const req = new NextRequest("http://localhost/api/knowledge-bases");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.knowledgeBases).toHaveLength(1);
    expect(body.knowledgeBases[0].name).toBe("Docs KB");
  });

  it("triggers reconciliation for stale indexing KBs", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    const staleDate = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      {
        id: "kb1", name: "Stale KB", indexingStatus: "indexing",
        gradientKbUuid: "do-kb-1", updatedAt: staleDate,
        sources: [{ id: "s1", gradientDatasourceUuid: "ds-1" }],
        _count: { sources: 1 },
      },
    ] as never);
    vi.mocked(reconcileStaleKbStatuses).mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/knowledge-bases");
    await GET(req);

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 10));
    expect(reconcileStaleKbStatuses).toHaveBeenCalledWith("org-1", expect.any(Array));
  });

  it("does NOT reconcile recently updated KBs", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([
      {
        id: "kb1", indexingStatus: "indexing",
        gradientKbUuid: "do-kb-1", updatedAt: new Date(), // just now
        sources: [],
        _count: { sources: 0 },
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/knowledge-bases");
    await GET(req);

    await new Promise((r) => setTimeout(r, 10));
    expect(reconcileStaleKbStatuses).not.toHaveBeenCalled();
  });

  it("filters by agentId when provided", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/knowledge-bases?agentId=a1");
    await GET(req);

    expect(prisma.knowledgeBase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          agents: { some: { agentId: "a1" } },
        }),
      }),
    );
  });
});

describe("POST /api/knowledge-bases", () => {
  it("creates KB with 201 status", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkKbLimit).mockResolvedValue(undefined);
    vi.mocked(prisma.knowledgeBase.create).mockResolvedValue({
      id: "kb1", name: "New KB", orgId: "org-1", indexingStatus: "pending",
    } as never);

    const req = new NextRequest("http://localhost/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "New KB" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("New KB");
  });

  it("trims the name", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkKbLimit).mockResolvedValue(undefined);
    vi.mocked(prisma.knowledgeBase.create).mockResolvedValue({ id: "kb1" } as never);

    const req = new NextRequest("http://localhost/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "  Padded Name  " }),
    });

    await POST(req);

    expect(prisma.knowledgeBase.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "Padded Name" },
    });
  });

  it("returns 400 when name is empty string", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkKbLimit).mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is whitespace only", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkKbLimit).mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(checkKbLimit).mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
