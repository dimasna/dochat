import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { uploadToSpaces, addSourceToKb } from "@/lib/knowledge-base";
import { checkSourceLimit } from "@/lib/limits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: kbId } = await params;
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb || kb.orgId !== orgId) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    await checkSourceLimit(orgId, kbId);

    // Block source addition while OpenSearch DB is provisioning (paid plans only).
    // Free users share a pre-provisioned DB so they're never blocked.
    const sub = await prisma.subscription.findUnique({
      where: { orgId },
      select: { plan: true },
    });
    if ((sub?.plan ?? "free") !== "free") {
      const allKbs = await prisma.knowledgeBase.findMany({
        where: { orgId },
        select: { indexingStatus: true },
      });
      const hasReady = allKbs.some((k) => k.indexingStatus === "ready");
      const hasInProgress = allKbs.some((k) =>
        ["creating", "indexing"].includes(k.indexingStatus),
      );
      if (allKbs.length > 0 && !hasReady && hasInProgress) {
        return NextResponse.json(
          { error: "Database is still provisioning. Please wait until the current indexing completes." },
          { status: 409 },
        );
      }
    }

    const formData = await req.formData();
    const sourceType = (formData.get("sourceType") as string) || "file";

    let source;

    if (sourceType === "file") {
      source = await handleFileSource(formData, kbId);
    } else if (sourceType === "website") {
      source = await handleWebsiteSource(formData, kbId);
    } else if (sourceType === "text") {
      source = await handleTextSource(formData, kbId);
    } else {
      return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
    }

    // Fire-and-forget: add datasource to DO KB in background
    addSourceToKb(orgId, kbId, source.id).catch((err) =>
      console.error("[kb-sources] Failed to add source to KB:", err),
    );

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

async function handleFileSource(formData: FormData, kbId: string) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const fileBuffer = await file.arrayBuffer();
  const spacesObjectKey = await uploadToSpaces(file.name, fileBuffer, kbId, file.type || undefined);

  return prisma.knowledgeSource.create({
    data: {
      knowledgeBaseId: kbId,
      sourceType: "file",
      title: file.name,
      fileName: file.name,
      spacesObjectKey,
      mimeType: file.type,
      fileSize: file.size,
    },
  });
}

async function handleWebsiteSource(formData: FormData, kbId: string) {
  const url = formData.get("url") as string;
  const title = (formData.get("title") as string) || url;

  if (!url) throw new Error("No URL provided");

  return prisma.knowledgeSource.create({
    data: {
      knowledgeBaseId: kbId,
      sourceType: "website",
      title,
      sourceUrl: url,
    },
  });
}

async function handleTextSource(formData: FormData, kbId: string) {
  const content = formData.get("content") as string;
  const title = (formData.get("title") as string) || "Untitled";

  if (!content) throw new Error("No content provided");

  const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = `${safeTitle}.txt`;
  const textBuffer = new TextEncoder().encode(content);

  const spacesObjectKey = await uploadToSpaces(
    fileName,
    textBuffer.buffer as ArrayBuffer,
    kbId,
    "text/plain",
  );

  return prisma.knowledgeSource.create({
    data: {
      knowledgeBaseId: kbId,
      sourceType: "text",
      title,
      fileName,
      spacesObjectKey,
      mimeType: "text/plain",
      fileSize: textBuffer.byteLength,
    },
  });
}
