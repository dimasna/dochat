import { NextRequest } from "next/server";
import { prisma } from "@dochat/db";
import { eventBus, type OrgEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");

  if (!sessionToken) {
    return new Response("sessionToken required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Verify session
  const session = await prisma.contactSession.findUnique({
    where: { sessionToken },
  });

  if (!session || session.expiresAt < new Date()) {
    return new Response("Invalid or expired session", {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Verify conversation belongs to this session
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.contactSessionId !== session.id) {
    return new Response("Conversation not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const orgId = conversation.orgId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages
      const initialMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "init", messages: initialMessages })}\n\n`,
        ),
      );

      // Subscribe to event bus for real-time updates
      const unsubscribe = eventBus.subscribe(orgId, (event: OrgEvent) => {
        try {
          if (
            event.type === "conversation:message" &&
            event.conversationId === conversationId &&
            event.message
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "message", message: event.message })}\n\n`,
              ),
            );
          } else if (
            event.type === "conversation:status" &&
            event.conversationId === conversationId
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "status", status: event.status })}\n\n`,
              ),
            );
          }
        } catch {
          // Stream closed
        }
      });

      // Keep-alive every 30s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
