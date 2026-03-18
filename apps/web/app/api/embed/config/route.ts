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
      { error: "orgId required" },
      { status: 400, headers: corsHeaders },
    );
  }

  // If agentId provided, get that agent's settings
  // Otherwise, find the first agent for this org
  let settings;
  let agentName: string | null = null;

  if (agentId) {
    settings = await prisma.widgetSettings.findUnique({
      where: { agentId },
    });
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    agentName = agent?.name ?? null;
  } else {
    const agent = await prisma.agent.findFirst({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    });
    if (agent) {
      agentName = agent.name;
      settings = await prisma.widgetSettings.findUnique({
        where: { agentId: agent.id },
      });
    }
  }

  if (!settings) {
    return NextResponse.json(
      { error: "Widget not configured" },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      agentName,
      greetMessage: settings.greetMessage,
      suggestion1: settings.suggestion1,
      suggestion2: settings.suggestion2,
      suggestion3: settings.suggestion3,
      themeColor: settings.themeColor,
      widgetLogo: settings.widgetLogo,
      voiceEnabled: settings.voiceEnabled,
    },
    { headers: corsHeaders },
  );
}
