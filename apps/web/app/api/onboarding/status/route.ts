import { NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    // Ensure subscription record exists for this org
    const subscription = await prisma.subscription.upsert({
      where: { orgId },
      update: {},
      create: { orgId, onboardingComplete: false },
    });

    const [knowledgeBases, agent] = await Promise.all([
      prisma.knowledgeBase.count({ where: { orgId } }),
      prisma.agent.findFirst({ where: { orgId } }),
    ]);

    // If subscription explicitly marked as onboarding complete, trust it
    if (subscription?.onboardingComplete) {
      return NextResponse.json({
        complete: true,
        steps: {
          knowledgeBase: true,
          agent: true,
        },
      });
    }

    return NextResponse.json({
      complete: false,
      steps: {
        knowledgeBase: knowledgeBases > 0,
        agent: !!agent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(error) },
    );
  }
}
