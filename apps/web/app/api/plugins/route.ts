import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    if (type) {
      const plugin = await prisma.plugin.findUnique({
        where: { orgId_service: { orgId, service: type } },
      });
      return NextResponse.json(plugin);
    }

    const plugins = await prisma.plugin.findMany({
      where: { orgId },
    });

    return NextResponse.json(plugins);
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

    const { type, config, enabled } = await req.json();

    const plugin = await prisma.plugin.upsert({
      where: { orgId_service: { orgId, service: type } },
      update: { config, enabled: enabled ?? true },
      create: { orgId, service: type, config },
    });

    return NextResponse.json(plugin, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const { orgId } = await getAuthUser();
    if (!orgId || !type) {
      return NextResponse.json({ error: "No organization or type" }, { status: 400 });
    }

    await prisma.plugin.delete({
      where: { orgId_service: { orgId, service: type } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
