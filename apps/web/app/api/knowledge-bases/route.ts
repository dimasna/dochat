import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { reconcileStaleKbStatuses } from "@/lib/knowledge-base";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const kbs = await prisma.knowledgeBase.findMany({
      where: { orgId },
      include: {
        sources: {
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { sources: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fire-and-forget: reconcile any KBs stuck in "indexing" for too long
    const staleKbs = kbs.filter(
      (kb) =>
        ["indexing", "creating"].includes(kb.indexingStatus) &&
        kb.gradientKbUuid &&
        Date.now() - new Date(kb.updatedAt).getTime() > 3 * 60 * 1000, // 3 min
    );
    if (staleKbs.length > 0) {
      reconcileStaleKbStatuses(orgId, staleKbs).catch((err) =>
        console.error("[GET knowledge-bases] reconcile failed:", err),
      );
    }

    return NextResponse.json(kbs);
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

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.create({
      data: {
        orgId,
        name: name.trim(),
      },
    });

    return NextResponse.json(kb, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
