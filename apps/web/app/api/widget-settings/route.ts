import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const settings = await prisma.widgetSettings.findUnique({
      where: { orgId },
    });

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
    const { greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber } = body;

    const settings = await prisma.widgetSettings.upsert({
      where: { orgId },
      update: { greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber },
      create: { orgId, greetMessage, suggestion1, suggestion2, suggestion3, vapiAssistantId, vapiPhoneNumber },
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
