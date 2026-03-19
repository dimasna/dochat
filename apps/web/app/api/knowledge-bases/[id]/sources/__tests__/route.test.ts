import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@dochat/db", () => ({
  prisma: {
    knowledgeBase: { findUnique: vi.fn(), findMany: vi.fn() },
    knowledgeSource: { create: vi.fn(), count: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  getErrorStatus: vi.fn((err: unknown) => {
    if (err && typeof err === "object" && "status" in err) return (err as { status: number }).status;
    return 500;
  }),
}));

vi.mock("@/lib/knowledge-base", () => ({
  uploadToSpaces: vi.fn(),
  addSourceToKb: vi.fn(),
}));

vi.mock("@/lib/limits", () => ({
  checkSourceLimit: vi.fn(),
  LimitError: class LimitError extends Error {
    status = 403;
    constructor(message: string) {
      super(message);
    }
  },
}));

import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { uploadToSpaces, addSourceToKb } from "@/lib/knowledge-base";
import { checkSourceLimit } from "@/lib/limits";
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: "org-1" });
  vi.mocked(checkSourceLimit).mockResolvedValue(undefined);
  vi.mocked(addSourceToKb).mockResolvedValue(undefined);
});

function makeFormData(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

function makeRequest(formData: FormData, kbId = "kb-1") {
  return new NextRequest(`http://localhost/api/knowledge-bases/${kbId}/sources`, {
    method: "POST",
    body: formData,
  });
}

const mockParams = { params: Promise.resolve({ id: "kb-1" }) };

describe("POST /api/knowledge-bases/:id/sources", () => {
  it("returns 400 when no org", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ userId: "u1", orgId: null as unknown as string });

    const fd = makeFormData({ sourceType: "website", url: "https://example.com" });
    const res = await POST(makeRequest(fd), mockParams);

    expect(res.status).toBe(400);
  });

  it("returns 404 when KB not found", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue(null);

    const fd = makeFormData({ sourceType: "website", url: "https://example.com" });
    const res = await POST(makeRequest(fd), mockParams);

    expect(res.status).toBe(404);
  });

  it("returns 404 when KB belongs to different org", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-other",
    } as never);

    const fd = makeFormData({ sourceType: "website", url: "https://example.com" });
    const res = await POST(makeRequest(fd), mockParams);

    expect(res.status).toBe(404);
  });

  it("calls checkSourceLimit before processing", async () => {
    const { LimitError } = await import("@/lib/limits");
    vi.mocked(checkSourceLimit).mockRejectedValue(new LimitError("Source limit reached"));
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);

    const fd = makeFormData({ sourceType: "website", url: "https://example.com" });
    const res = await POST(makeRequest(fd), mockParams);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("Source limit reached");
  });

  it("creates a website source successfully", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.knowledgeSource.create).mockResolvedValue({
      id: "src-1", knowledgeBaseId: "kb-1", sourceType: "website",
      title: "Example", sourceUrl: "https://example.com",
    } as never);

    const fd = makeFormData({
      sourceType: "website",
      url: "https://example.com",
      title: "Example",
    });
    const res = await POST(makeRequest(fd), mockParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.sourceType).toBe("website");
    expect(body.sourceUrl).toBe("https://example.com");
    expect(prisma.knowledgeSource.create).toHaveBeenCalledWith({
      data: {
        knowledgeBaseId: "kb-1",
        sourceType: "website",
        title: "Example",
        sourceUrl: "https://example.com",
      },
    });
  });

  it("creates a file source successfully", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);
    vi.mocked(uploadToSpaces).mockResolvedValue("kb-sources/kb-1/test.pdf");
    vi.mocked(prisma.knowledgeSource.create).mockResolvedValue({
      id: "src-1", knowledgeBaseId: "kb-1", sourceType: "file",
      title: "test.pdf", fileName: "test.pdf",
      spacesObjectKey: "kb-sources/kb-1/test.pdf",
      mimeType: "application/pdf", fileSize: 1024,
    } as never);

    const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.append("sourceType", "file");
    fd.append("file", file);

    const res = await POST(makeRequest(fd), mockParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.sourceType).toBe("file");
    expect(uploadToSpaces).toHaveBeenCalled();
  });

  it("creates a text source successfully", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);
    vi.mocked(uploadToSpaces).mockResolvedValue("kb-sources/kb-1/My_FAQ.txt");
    vi.mocked(prisma.knowledgeSource.create).mockResolvedValue({
      id: "src-1", knowledgeBaseId: "kb-1", sourceType: "text",
      title: "My FAQ", fileName: "My_FAQ.txt",
      spacesObjectKey: "kb-sources/kb-1/My_FAQ.txt",
      mimeType: "text/plain", fileSize: 50,
    } as never);

    const fd = makeFormData({
      sourceType: "text",
      title: "My FAQ",
      content: "Frequently asked questions content",
    });
    const res = await POST(makeRequest(fd), mockParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.sourceType).toBe("text");
    expect(uploadToSpaces).toHaveBeenCalled();
  });

  it("returns 400 for invalid sourceType", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);

    const fd = makeFormData({ sourceType: "invalid" });
    const res = await POST(makeRequest(fd), mockParams);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid sourceType");
  });

  it("fires addSourceToKb in background after success", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);
    vi.mocked(prisma.knowledgeSource.create).mockResolvedValue({
      id: "src-1", knowledgeBaseId: "kb-1", sourceType: "website",
      title: "Test", sourceUrl: "https://test.com",
    } as never);

    const fd = makeFormData({
      sourceType: "website",
      url: "https://test.com",
    });
    await POST(makeRequest(fd), mockParams);

    expect(addSourceToKb).toHaveBeenCalledWith("org-1", "kb-1", "src-1");
  });

  it("returns 500 when Spaces upload fails", async () => {
    vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValue({
      id: "kb-1", orgId: "org-1",
    } as never);
    vi.mocked(uploadToSpaces).mockRejectedValue(new Error("SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY must be configured"));

    const file = new File(["data"], "test.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.append("sourceType", "file");
    fd.append("file", file);

    const res = await POST(makeRequest(fd), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("SPACES_ACCESS_KEY_ID");
  });
});
