import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { checkAgentEndpointHealth, recoverAgent } from "@/lib/agent";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { status: "active", agentEndpoint: { not: "" } },
    select: { id: true, name: true, agentEndpoint: true },
  });

  const recovered: string[] = [];

  for (const agent of agents) {
    const healthy = await checkAgentEndpointHealth(agent.agentEndpoint);
    if (!healthy) {
      console.log(`[cron/health-check] Agent ${agent.id} (${agent.name}) endpoint unreachable, recovering...`);
      await recoverAgent(agent.id);
      recovered.push(agent.id);
    }
  }

  console.log(`[cron/health-check] Checked ${agents.length} agents, recovered ${recovered.length}`);

  return NextResponse.json({
    checked: agents.length,
    recovered,
  });
}
