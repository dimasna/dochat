import { NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const [total, unresolved, escalated, resolved] = await Promise.all([
      prisma.conversation.count({ where: { orgId } }),
      prisma.conversation.count({ where: { orgId, status: "unresolved" } }),
      prisma.conversation.count({ where: { orgId, status: "escalated" } }),
      prisma.conversation.count({ where: { orgId, status: "resolved" } }),
    ]);

    return NextResponse.json({ total, unresolved, escalated, resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
