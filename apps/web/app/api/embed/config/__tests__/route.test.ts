import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    widgetSettings: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@dochat/db";
import { GET, OPTIONS } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OPTIONS /api/embed/config", () => {
  it("returns 204 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("GET /api/embed/config", () => {
  it("returns widget settings for specific agentId", async () => {
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue({
      greetMessage: "Welcome!",
      suggestion1: "How do I?",
      suggestion2: null,
      suggestion3: null,
      themeColor: "#3B82F6",
      widgetLogo: null,
    } as never);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      name: "Support Bot",
    } as never);

    const req = new NextRequest("http://localhost/api/embed/config?orgId=org-1&agentId=a1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.agentName).toBe("Support Bot");
    expect(body.greetMessage).toBe("Welcome!");
    expect(body.suggestion1).toBe("How do I?");
    expect(body.themeColor).toBe("#3B82F6");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("falls back to first agent when agentId not provided", async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValue({
      id: "a1", name: "Default Agent",
    } as never);
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue({
      greetMessage: "Hi!", suggestion1: null, suggestion2: null,
      suggestion3: null, themeColor: null, widgetLogo: null,
    } as never);

    const req = new NextRequest("http://localhost/api/embed/config?orgId=org-1");
    const res = await GET(req);
    const body = await res.json();

    expect(body.agentName).toBe("Default Agent");
    expect(prisma.agent.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns 400 when orgId is missing", async () => {
    const req = new NextRequest("http://localhost/api/embed/config");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("orgId required");
  });

  it("returns 404 when no widget settings found", async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/embed/config?orgId=org-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Widget not configured");
  });

  it("returns 404 when agentId specified but no settings exist", async () => {
    vi.mocked(prisma.widgetSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ name: "Bot" } as never);

    const req = new NextRequest("http://localhost/api/embed/config?orgId=org-1&agentId=a1");
    const res = await GET(req);

    expect(res.status).toBe(404);
  });
});
