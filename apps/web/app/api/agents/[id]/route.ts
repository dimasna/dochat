import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { deleteDoAgent, updateDoAgent, tryFinalizeAgent } from "@/lib/agent";

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

    let agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        widgetSettings: true,
        documents: {
          include: { document: true },
        },
        _count: { select: { conversations: true } },
      },
    });

    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Auto-finalize: if provisioning, check if DO agent is deployed and activate it
    if (agent.status === "provisioning") {
      const finalized = await tryFinalizeAgent(agent.id);
      if (finalized) {
        agent = await prisma.agent.findUnique({
          where: { id },
          include: {
            widgetSettings: true,
            documents: {
              include: { document: true },
            },
            _count: { select: { conversations: true } },
          },
        }) as typeof agent;
      }
    }

    return NextResponse.json(agent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(
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
    const { name, description, instruction } = body;

    // Sync name/instruction to DO agent (skip if still provisioning — agent may not be deployed yet)
    if (agent.status === "active" && agent.agentUuid) {
      const doUpdates: { name?: string; instruction?: string } = {};
      if (name !== undefined) doUpdates.name = name;
      if (instruction !== undefined) doUpdates.instruction = instruction;

      if (Object.keys(doUpdates).length > 0) {
        try {
          await updateDoAgent(agent.agentUuid, doUpdates);
        } catch (err) {
          console.error("[PATCH agent] DO update failed:", err);
          // Continue — still update DB
        }
      }
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(instruction !== undefined && { instruction }),
      },
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
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete from DO (agent + workspace + KB)
    await deleteDoAgent({
      agentUuid: agent.agentUuid,
      workspaceUuid: agent.workspaceUuid,
      gradientKbUuid: agent.gradientKbUuid,
    });

    // Delete from DB (cascade deletes AgentDocument, WidgetSettings, etc.)
    await prisma.agent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
