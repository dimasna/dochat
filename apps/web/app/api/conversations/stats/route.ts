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

    // Get playground conversation IDs to exclude.
    // Prisma's NOT + JSON path doesn't work through relation filters.
    const playgroundConvs = await prisma.conversation.findMany({
      where: {
        orgId,
        contactSession: { metadata: { path: ["isPlayground"], equals: true } },
      },
      select: { id: true },
    });
    const playgroundIds = playgroundConvs.map((c) => c.id);

    const where: Record<string, unknown> = {
      orgId,
      ...(playgroundIds.length > 0 ? { id: { notIn: playgroundIds } } : {}),
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
