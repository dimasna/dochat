import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { provisionAgent } from "@/lib/agent";

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, instruction, greetMessage, suggestion1, suggestion2, suggestion3 } = body;

    // Get only indexed ("ready") KBs to attach to the agent
    const kbs = await prisma.knowledgeBase.findMany({
      where: { orgId, indexingStatus: "ready" },
      select: { id: true },
    });
    const knowledgeBaseIds = kbs.map((kb) => kb.id);

    // Provision agent (fire-and-forget deployment)
    const agent = await provisionAgent(
      orgId,
      name || "Support Agent",
      instruction || undefined,
      knowledgeBaseIds.length > 0 ? knowledgeBaseIds : undefined,
    );

    // Create widget settings for the agent
    await prisma.widgetSettings.create({
      data: {
        agentId: agent.id,
        orgId,
        greetMessage: greetMessage || "Hi! How can I help you today?",
        suggestion1: suggestion1 || null,
        suggestion2: suggestion2 || null,
        suggestion3: suggestion3 || null,
      },
    });

    // Mark onboarding as complete
    await prisma.subscription.upsert({
      where: { orgId },
      update: { onboardingComplete: true },
      create: { orgId, onboardingComplete: true },
    });

    return NextResponse.json({
      success: true,
      agentId: agent.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(error) },
    );
  }
}
