import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";

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

    // Generate AI response if subscription active and conversation unresolved
    const subscription = await prisma.subscription.findUnique({
      where: { orgId: conversation.orgId },
    });

    let assistantMessage = null;

    if (
      conversation.status === "unresolved" &&
      subscription?.status === "active"
    ) {
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
      } catch {
        assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content:
              "I'm sorry, I'm having trouble right now. Would you like me to connect you with a human support agent?",
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
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
