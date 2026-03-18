import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    conversation: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn().mockReturnValue(500),
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no playground conversations to exclude
  vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
});

describe("GET /api/conversations/stats", () => {
  it("returns conversation counts by status", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.conversation.count)
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(30)  // unresolved
      .mockResolvedValueOnce(10)  // escalated
      .mockResolvedValueOnce(10); // resolved

    const req = new NextRequest("http://localhost/api/conversations/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      total: 50,
      unresolved: 30,
      escalated: 10,
      resolved: 10,
    });
  });

  it("filters by agentId when provided", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
    vi.mocked(prisma.conversation.count).mockResolvedValue(5);

    const req = new NextRequest("http://localhost/api/conversations/stats?agentId=a1");
    await GET(req);

    // All count calls should include agentId
    for (const call of vi.mocked(prisma.conversation.count).mock.calls) {
      expect(call[0].where).toHaveProperty("agentId", "a1");
    }
  });

  it("returns 400 when no orgId", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: undefined });

    const req = new NextRequest("http://localhost/api/conversations/stats");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});
