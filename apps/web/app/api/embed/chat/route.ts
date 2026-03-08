import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";
import { eventBus } from "@/lib/event-bus";
import { checkMessageCreditLimit, LimitError } from "@/lib/limits";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, sessionToken, content } = await req.json();

    if (!conversationId || !sessionToken || !content) {
      return NextResponse.json(
        { error: "conversationId, sessionToken, and content required" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Verify session token
    const session = await prisma.contactSession.findUnique({
      where: { sessionToken },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify conversation belongs to this session
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.contactSessionId !== session.id) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: { conversationId, role: "user", content },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Emit user message event
    eventBus.emit(conversation.orgId, {
      type: "conversation:message",
      id: userMessage.id,
      status: "created",
      conversationId,
      message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
      },
    });

    // Generate AI response if subscription active and conversation unresolved
    const subscription = await prisma.subscription.findUnique({
      where: { orgId: conversation.orgId },
    });

    let assistantMessage = null;

    if (
      conversation.status === "unresolved" &&
      subscription?.status === "active"
    ) {
      // Check message credit limit before generating AI response
      await checkMessageCreditLimit(conversation.orgId);
      try {
        const agentResponse = await generateAgentResponse(
          conversationId,
          conversation.agentId,
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
      } catch (err) {
        console.error("[embed/chat] generateAgentResponse failed:", err);
        assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content:
              "I'm sorry, I'm having trouble right now. Would you like me to connect you with a human support agent?",
          },
        });
      }

      // Emit assistant message event
      if (assistantMessage) {
        eventBus.emit(conversation.orgId, {
          type: "conversation:message",
          id: assistantMessage.id,
          status: "created",
          conversationId,
          message: {
            id: assistantMessage.id,
            role: assistantMessage.role,
            content: assistantMessage.content,
            createdAt: assistantMessage.createdAt.toISOString(),
          },
        });
      }
    }

    return NextResponse.json(
      { userMessage, assistantMessage },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = error instanceof LimitError ? error.status : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders },
    );
  }
}
