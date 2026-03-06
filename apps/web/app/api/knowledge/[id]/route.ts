import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { deleteFile } from "@/lib/spaces";
import { removeDataSourceFromKb } from "@/lib/knowledge-base";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await getAuthUser();

    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        agents: {
          include: { agent: { select: { gradientKbUuid: true } } },
        },
      },
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete from Spaces (only for file and text sources)
    if (doc.spacesKey) {
      await deleteFile(doc.spacesKey);
    }

    // Remove from all agent KBs where this doc was indexed
    for (const agentDoc of doc.agents) {
      if (agentDoc.gradientSourceId && agentDoc.agent.gradientKbUuid) {
        await removeDataSourceFromKb(
          agentDoc.agent.gradientKbUuid,
          agentDoc.gradientSourceId,
        ).catch(() => {});
      }
    }

    // Cascade deletes AgentDocument records too
    await prisma.knowledgeDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
