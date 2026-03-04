import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { deleteFile } from "@/lib/spaces";
import { getKnowledgeBaseUuid, removeDataSourceFromKb } from "@/lib/knowledge-base";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { orgId } = await getAuthUser();

    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete from Spaces (only for file and text sources)
    if (doc.spacesKey) {
      await deleteFile(doc.spacesKey);
    }

    // Delete from org's Gradient KB if indexed
    if (doc.gradientSourceId && orgId) {
      const kbUuid = await getKnowledgeBaseUuid(orgId);
      if (kbUuid) {
        await removeDataSourceFromKb(kbUuid, doc.gradientSourceId);
      }
    }

    await prisma.knowledgeDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
