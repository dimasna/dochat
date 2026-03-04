import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { generateAgentResponse } from "@/lib/agent";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "conversationId and content required" },
        { status: 400 },
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
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

    // Generate agent response
    const agentResponse = await generateAgentResponse(
      conversationId,
      conversation.orgId,
      content,
    );

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: agentResponse.content,
        metadata: agentResponse.toolCalls
          ? { toolCalls: agentResponse.toolCalls }
          : undefined,
      },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
