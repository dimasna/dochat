import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { eventBus } from "@/lib/event-bus";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "50");

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return NextResponse.json({
      messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.orgId !== orgId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Internal/support user reply — save as "support" role, no AI trigger
    const supportMessage = await prisma.message.create({
      data: { conversationId, role: "support", content },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Emit support message event
    eventBus.emit(orgId, {
      type: "conversation:message",
      id: supportMessage.id,
      status: "created",
      conversationId,
      message: {
        id: supportMessage.id,
        role: supportMessage.role,
        content: supportMessage.content,
        createdAt: supportMessage.createdAt.toISOString(),
      },
    });

    return NextResponse.json({ supportMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
