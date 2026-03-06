import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const agentId = req.nextUrl.searchParams.get("agentId");

    let settings;
    if (agentId) {
      settings = await prisma.widgetSettings.findUnique({
        where: { agentId },
      });
    } else {
      // Fallback: get first agent's settings
      settings = await prisma.widgetSettings.findFirst({
        where: { orgId },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const body = await req.json();
    const { agentId, greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    // Verify agent belongs to org
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const settings = await prisma.widgetSettings.upsert({
      where: { agentId },
      update: { greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber },
      create: { agentId, orgId, greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber },
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
