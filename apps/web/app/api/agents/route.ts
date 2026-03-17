import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { provisionAgent, tryFinalizeAgent } from "@/lib/agent";
import { checkAgentLimit } from "@/lib/limits";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const agents = await prisma.agent.findMany({
      where: { orgId },
      include: {
        _count: { select: { conversations: true, knowledgeBases: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fire-and-forget: finalize any agents stuck in "provisioning" or "recovering"
    const pendingAgents = agents.filter((a) => a.status === "provisioning" || a.status === "recovering");
    if (pendingAgents.length > 0) {
      Promise.all(
        pendingAgents.map((a) => tryFinalizeAgent(a.id)),
      ).catch((err) =>
        console.error("[GET agents] tryFinalizeAgent failed:", err),
      );
    }

    return NextResponse.json(agents);
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

    await checkAgentLimit(orgId);

    const body = await req.json();
    const { name, description, instruction, knowledgeBaseIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const agent = await provisionAgent(orgId, name, instruction, knowledgeBaseIds);

    // Update description if provided
    if (description) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { description },
      });
    }

    // Create default widget settings for this agent
    await prisma.widgetSettings.create({
      data: {
        agentId: agent.id,
        orgId,
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
