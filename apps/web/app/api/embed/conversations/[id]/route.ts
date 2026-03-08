import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { eventBus } from "@/lib/event-bus";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation || conversation.contactSessionId !== session.id) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      id: conversation.id,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
    },
    { headers: corsHeaders },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { sessionToken, status } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "sessionToken required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!status || !["resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation || conversation.contactSessionId !== session.id) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status },
    });

    eventBus.emit(updated.orgId, {
      type: "conversation:status",
      id: updated.id,
      status: updated.status,
      conversationId: updated.id,
    });

    return NextResponse.json(
      { id: updated.id, status: updated.status },
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
