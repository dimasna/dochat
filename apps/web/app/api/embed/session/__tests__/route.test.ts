import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    contactSession: { create: vi.fn() },
  },
}));

import { prisma } from "@dochat/db";
import { POST, OPTIONS } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OPTIONS /api/embed/session", () => {
  it("returns 204 with CORS headers", async () => {
    const res = await OPTIONS();

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("POST /api/embed/session", () => {
  it("creates session with 24h expiry and returns sessionId + token", async () => {
    vi.mocked(prisma.contactSession.create).mockResolvedValue({
      id: "session-1",
      sessionToken: "tok-abc123",
    } as never);

    const req = new NextRequest("http://localhost/api/embed/session", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", name: "John", email: "john@test.com" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.sessionId).toBe("session-1");
    expect(body.sessionToken).toBe("tok-abc123");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");

    // Verify expiry is ~24h from now
    const createCall = vi.mocked(prisma.contactSession.create).mock.calls[0][0];
    const expiry = new Date(createCall.data.expiresAt);
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000); // > 23h
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // <= 24h
  });

  it("passes metadata through", async () => {
    vi.mocked(prisma.contactSession.create).mockResolvedValue({
      id: "s1", sessionToken: "tok",
    } as never);

    const metadata = { timezone: "America/New_York", language: "en" };
    const req = new NextRequest("http://localhost/api/embed/session", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", name: "John", email: "j@t.com", metadata }),
    });

    await POST(req);

    const createCall = vi.mocked(prisma.contactSession.create).mock.calls[0][0];
    expect(createCall.data.metadata).toEqual(metadata);
  });

  it("returns 400 when orgId is missing", async () => {
    const req = new NextRequest("http://localhost/api/embed/session", {
      method: "POST",
      body: JSON.stringify({ name: "John", email: "j@t.com" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("orgId, name, and email required");
  });

  it("returns 400 when name is missing", async () => {
    const req = new NextRequest("http://localhost/api/embed/session", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", email: "j@t.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = new NextRequest("http://localhost/api/embed/session", {
      method: "POST",
      body: JSON.stringify({ orgId: "org-1", name: "John" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
