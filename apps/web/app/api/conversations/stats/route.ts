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
    const where: Record<string, unknown> = {
      orgId,
      contactSession: {
        NOT: { metadata: { path: ["isPlayground"], equals: true } },
      },
    };
    if (agentId) where.agentId = agentId;

    const [total, unresolved, escalated, resolved] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...where, status: "unresolved" } }),
      prisma.conversation.count({ where: { ...where, status: "escalated" } }),
      prisma.conversation.count({ where: { ...where, status: "resolved" } }),
    ]);

    return NextResponse.json({ total, unresolved, escalated, resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
