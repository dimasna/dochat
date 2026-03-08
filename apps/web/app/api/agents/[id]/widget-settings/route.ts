import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

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

    const settings = await prisma.widgetSettings.findUnique({
      where: { agentId: id },
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function PUT(
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
    const { greetMessage, suggestion1, suggestion2, suggestion3 } = body;

    const settings = await prisma.widgetSettings.upsert({
      where: { agentId: id },
      update: { greetMessage, suggestion1, suggestion2, suggestion3 },
      create: { agentId: id, orgId, greetMessage, suggestion1, suggestion2, suggestion3 },
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
