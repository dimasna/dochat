import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { eventBus, type OrgEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { orgId } = await getAuthUser();
  if (!orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so the client knows the connection is alive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const listener = (event: OrgEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream closed, will be cleaned up by abort handler
        }
      };

      const unsubscribe = eventBus.subscribe(orgId, listener);

      // Keep-alive every 30s to prevent proxy/browser timeout
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
