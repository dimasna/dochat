import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { getUploadUrl, getPublicUrl } from "@/lib/spaces";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const docs = await prisma.knowledgeDocument.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(docs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const formData = await req.formData();
    const sourceType = (formData.get("sourceType") as string) || "file";

    let doc;

    if (sourceType === "file") {
      doc = await handleFileSource(formData, orgId);
    } else if (sourceType === "website") {
      doc = await handleWebsiteSource(formData, orgId);
    } else if (sourceType === "text") {
      doc = await handleTextSource(formData, orgId);
    } else {
      return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

async function handleFileSource(formData: FormData, orgId: string) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const key = `knowledge/${orgId}/${Date.now()}-${file.name}`;
  const uploadUrl = await getUploadUrl(key, file.type);
  const publicUrl = getPublicUrl(key);

  const fileBuffer = await file.arrayBuffer();
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Failed to upload file to storage: ${uploadRes.status} ${errText}`);
  }

  return prisma.knowledgeDocument.create({
    data: {
      orgId,
      sourceType: "file",
      title: file.name,
      fileName: file.name,
      fileUrl: publicUrl,
      spacesKey: key,
      mimeType: file.type,
      fileSize: file.size,
    },
  });
}

async function handleWebsiteSource(formData: FormData, orgId: string) {
  const url = formData.get("url") as string;
  const title = (formData.get("title") as string) || url;

  if (!url) throw new Error("No URL provided");

  return prisma.knowledgeDocument.create({
    data: {
      orgId,
      sourceType: "website",
      title,
      sourceUrl: url,
    },
  });
}

async function handleTextSource(formData: FormData, orgId: string) {
  const content = formData.get("content") as string;
  const title = (formData.get("title") as string) || "Untitled";

  if (!content) throw new Error("No content provided");

  const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, "_");
  const key = `knowledge/${orgId}/${Date.now()}-${safeTitle}.txt`;
  const uploadUrl = await getUploadUrl(key, "text/plain");
  const publicUrl = getPublicUrl(key);

  const textBuffer = new TextEncoder().encode(content);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: textBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Failed to upload text to storage: ${uploadRes.status} ${errText}`);
  }

  return prisma.knowledgeDocument.create({
    data: {
      orgId,
      sourceType: "text",
      title,
      fileName: `${safeTitle}.txt`,
      fileUrl: publicUrl,
      spacesKey: key,
      mimeType: "text/plain",
      fileSize: textBuffer.byteLength,
    },
  });
}
