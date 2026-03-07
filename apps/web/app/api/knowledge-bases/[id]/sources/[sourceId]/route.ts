import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { removeSourceFromKb } from "@/lib/knowledge-base";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const { id: kbId, sourceId } = await params;
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb || kb.orgId !== orgId) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source || source.knowledgeBaseId !== kbId) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Remove datasource from DO KB (best effort)
    if (kb.gradientKbUuid && source.gradientDatasourceUuid) {
      await removeSourceFromKb(kb.gradientKbUuid, source.gradientDatasourceUuid);
    }

    // Delete the source record
    await prisma.knowledgeSource.delete({ where: { id: sourceId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
