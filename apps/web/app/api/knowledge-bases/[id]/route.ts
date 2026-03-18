import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { deleteKnowledgeBase } from "@/lib/knowledge-base";
import { detachKbFromAgent } from "@/lib/agent";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.orgId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updated = await prisma.knowledgeBase.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await getAuthUser();

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        agents: {
          include: { agent: true },
        },
      },
    });
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Collect affected agents before cascade delete
    const affectedAgents = kb.agents.map((akb) => akb.agent);

    // Delete the DO KB
    if (kb.gradientKbUuid) {
      await deleteKnowledgeBase(kb.gradientKbUuid);

      // Detach from all affected DO agents (fire-and-forget)
      for (const agent of affectedAgents) {
        detachKbFromAgent(agent.agentUuid, kb.gradientKbUuid).catch((err) =>
          console.error(`[kb-delete] Failed to detach KB from agent ${agent.id}:`, err),
        );
      }
    }

    // Cascade deletes sources and AgentKnowledgeBase records
    await prisma.knowledgeBase.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
