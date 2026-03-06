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

    // Get all org docs to attach to the agent
    const docs = await prisma.knowledgeDocument.findMany({
      where: { orgId },
      select: { id: true },
    });
    const documentIds = docs.map((d) => d.id);

    // Provision agent (fire-and-forget deployment)
    const agent = await provisionAgent(
      orgId,
      name || "Support Agent",
      instruction || undefined,
      documentIds.length > 0 ? documentIds : undefined,
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
