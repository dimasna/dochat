import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { syncAgentKbs } from "@/lib/agent";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentKbs = await prisma.agentKnowledgeBase.findMany({
      where: { agentId: id },
      include: {
        knowledgeBase: {
          include: { sources: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(agentKbs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status === "provisioning") {
      return NextResponse.json({ error: "Agent is still provisioning" }, { status: 400 });
    }

    const body = await req.json();
    const { knowledgeBaseIds } = body;

    if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return NextResponse.json({ error: "knowledgeBaseIds required" }, { status: 400 });
    }

    // Verify all KBs are ready
    const kbs = await prisma.knowledgeBase.findMany({
      where: { id: { in: knowledgeBaseIds }, orgId, indexingStatus: "ready" },
    });

    if (kbs.length !== knowledgeBaseIds.length) {
      return NextResponse.json({ error: "Some knowledge bases are not ready or not found" }, { status: 400 });
    }

    // Create AgentKnowledgeBase records
    await prisma.agentKnowledgeBase.createMany({
      data: knowledgeBaseIds.map((kbId: string) => ({
        agentId: id,
        knowledgeBaseId: kbId,
      })),
      skipDuplicates: true,
    });

    // Collect ALL KB UUIDs that should be on this agent (full sync)
    const allAgentKbs = await prisma.agentKnowledgeBase.findMany({
      where: { agentId: id },
      include: { knowledgeBase: true },
    });
    const allKbUuids = allAgentKbs
      .map((akb) => akb.knowledgeBase.gradientKbUuid)
      .filter((uuid): uuid is string => !!uuid);

    // Recreate DO agent with updated KBs (fire-and-forget)
    // DO API only links KBs at creation time, so we must recreate
    syncAgentKbs(agent.id, allKbUuids).catch((err) =>
      console.error("[agent-kbs] Failed to sync KBs:", err),
    );

    return NextResponse.json({ success: true, count: knowledgeBaseIds.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await req.json();
    const { knowledgeBaseId } = body;

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: "knowledgeBaseId required" }, { status: 400 });
    }

    const agentKb = await prisma.agentKnowledgeBase.findUnique({
      where: {
        agentId_knowledgeBaseId: {
          agentId: id,
          knowledgeBaseId,
        },
      },
    });

    if (!agentKb) {
      return NextResponse.json({ error: "Knowledge base not attached to agent" }, { status: 404 });
    }

    // Remove from DB
    await prisma.agentKnowledgeBase.delete({ where: { id: agentKb.id } });

    // Collect remaining KB UUIDs and sync DO agent (fire-and-forget)
    const remainingKbs = await prisma.agentKnowledgeBase.findMany({
      where: { agentId: id },
      include: { knowledgeBase: true },
    });
    const remainingUuids = remainingKbs
      .map((akb) => akb.knowledgeBase.gradientKbUuid)
      .filter((uuid): uuid is string => !!uuid);

    // Recreate DO agent with remaining KBs (fire-and-forget)
    syncAgentKbs(agent.id, remainingUuids).catch((err) =>
      console.error("[agent-kbs] Failed to sync KBs:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
