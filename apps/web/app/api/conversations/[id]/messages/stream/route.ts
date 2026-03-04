import { NextRequest } from "next/server";
import { prisma } from "@dochat/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;

  const encoder = new TextEncoder();
  let lastMessageTime = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages
      const initialMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "init", messages: initialMessages })}\n\n`,
        ),
      );

      if (initialMessages.length > 0) {
        lastMessageTime = initialMessages[initialMessages.length - 1].createdAt;
      }

      // Poll for new messages
      const interval = setInterval(async () => {
        try {
          const newMessages = await prisma.message.findMany({
            where: {
              conversationId,
              createdAt: { gt: lastMessageTime },
            },
            orderBy: { createdAt: "asc" },
          });

          for (const msg of newMessages) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "message", message: msg })}\n\n`,
              ),
            );
            lastMessageTime = msg.createdAt;
          }

          // Also check conversation status changes
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { status: true },
          });

          if (conversation) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "status", status: conversation.status })}\n\n`,
              ),
            );
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
