import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";

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
    const { id: conversationId } = await params;
    const body = await req.json();
    const { content, sessionToken } = body;

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: { conversationId, role: "user", content },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Check if AI agent should respond
    const subscription = await prisma.subscription.findUnique({
      where: { orgId: conversation.orgId },
    });

    const shouldTriggerAgent =
      conversation.status === "unresolved" &&
      subscription?.status === "active";

    let assistantMessage = null;

    if (shouldTriggerAgent) {
      try {
        const agentResponse = await generateAgentResponse(
          conversationId,
          conversation.orgId,
          content,
        );

        assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: agentResponse.content,
            metadata: agentResponse.toolCalls
              ? { toolCalls: agentResponse.toolCalls }
              : undefined,
          },
        });
      } catch (agentError) {
        // Save error as system message but don't fail the request
        assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content:
              "I'm sorry, I'm having trouble processing your request right now. Would you like me to connect you with a human support agent?",
          },
        });
      }
    }

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
