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

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const agentId = req.nextUrl.searchParams.get("agentId");

  if (!orgId) {
    return NextResponse.json(
      { valid: false, reason: "Organization ID is required" },
      { headers: corsHeaders },
    );
  }

  // If agentId provided, validate that specific agent
  if (agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, orgId: true },
    });

    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json(
        { valid: false, reason: "Agent not found" },
        { headers: corsHeaders },
      );
    }

    return NextResponse.json({ valid: true }, { headers: corsHeaders });
  }

  // Otherwise validate org exists (has agent, subscription, or knowledge docs)
  const [hasAgent, hasSub, hasDocs] = await Promise.all([
    prisma.agent.findFirst({ where: { orgId }, select: { id: true } }),
    prisma.subscription.findUnique({ where: { orgId }, select: { id: true } }),
    prisma.knowledgeDocument.findFirst({ where: { orgId }, select: { id: true } }),
  ]);

  if (!hasAgent && !hasSub && !hasDocs) {
    return NextResponse.json(
      { valid: false, reason: "Organization not found" },
      { headers: corsHeaders },
    );
  }

  return NextResponse.json({ valid: true }, { headers: corsHeaders });
}
