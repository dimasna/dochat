import { NextRequest } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser } from "@/lib/auth";
import { eventBus, type OrgEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgId: string | undefined;
  try {
    ({ orgId } = await getAuthUser());
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify conversation belongs to this org
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { orgId: true },
  });

  if (!conversation || conversation.orgId !== orgId) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages from DB
      const initialMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
