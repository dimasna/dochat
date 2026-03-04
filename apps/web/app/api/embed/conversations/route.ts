import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// List conversations for a contact session
export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");
  if (!sessionToken) {
    return NextResponse.json(
      { error: "sessionToken required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const session = await prisma.contactSession.findUnique({
    where: { sessionToken },
  });

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401, headers: corsHeaders },
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: { contactSessionId: session.id },
    orderBy: { createdAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
  });

  const result = conversations.map((c) => ({
    id: c.id,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    lastMessage: c.messages[0]
      ? { text: c.messages[0].content, role: c.messages[0].role }
      : null,
  }));

  return NextResponse.json(result, { headers: corsHeaders });
}

// Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const { sessionToken, orgId } = await req.json();

    if (!sessionToken || !orgId) {
      return NextResponse.json(
        { error: "sessionToken and orgId required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const session = await prisma.contactSession.findUnique({
      where: { sessionToken },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401, headers: corsHeaders },
      );
    }

    // Load widget settings for greeting message
    const settings = await prisma.widgetSettings.findUnique({
      where: { orgId },
    });

    const conversation = await prisma.conversation.create({
      data: {
        orgId,
        contactSessionId: session.id,
        status: "unresolved",
      },
    });

    // Create greeting message if configured
    if (settings?.greetMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: settings.greetMessage,
        },
      });
    }

    return NextResponse.json(
      { conversationId: conversation.id },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
