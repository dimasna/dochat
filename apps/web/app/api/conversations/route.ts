import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const contactSessionId = req.nextUrl.searchParams.get("contactSessionId");

    // Public access for embed widget (via contact session)
    if (contactSessionId) {
      const conversations = await prisma.conversation.findMany({
        where: { contactSessionId },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          contactSession: { select: { name: true, email: true } },
          agent: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return NextResponse.json(conversations);
    }

    // Authenticated access for dashboard
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const agentId = req.nextUrl.searchParams.get("agentId");
    const where: Record<string, unknown> = {
      orgId,
      contactSession: {
        NOT: { metadata: { path: ["isPlayground"], equals: true } },
      },
    };
    if (status) where.status = status;
    if (agentId) where.agentId = agentId;

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        contactSession: { select: { id: true, name: true, email: true, metadata: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, contactSessionId, agentId } = body;

    if (!orgId || !contactSessionId) {
      return NextResponse.json(
        { error: "orgId and contactSessionId required" },
        { status: 400 },
      );
    }

    // Verify contact session exists
    const session = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Invalid contact session" },
        { status: 404 },
      );
    }

    // Resolve agent
    let resolvedAgentId = agentId;
    if (!resolvedAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { orgId },
        orderBy: { createdAt: "asc" },
      });
      if (!agent) {
        return NextResponse.json(
          { error: "No agent configured" },
          { status: 404 },
        );
      }
      resolvedAgentId = agent.id;
    }

    // Get widget settings for greeting
    const settings = await prisma.widgetSettings.findUnique({
      where: { agentId: resolvedAgentId },
    });

    const conversation = await prisma.conversation.create({
      data: {
        orgId,
        agentId: resolvedAgentId,
        contactSessionId,
        status: "unresolved",
      },
    });

    // Create greeting message
    if (settings?.greetMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: settings.greetMessage,
        },
      });
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
