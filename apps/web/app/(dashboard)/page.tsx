"use client";

import { useActiveAgent } from "@/hooks/use-active-agent";
import { useQuery } from "@tanstack/react-query";

export default function Page() {
  const { activeAgent, activeAgentId } = useActiveAgent();

  const { data: stats } = useQuery({
    queryKey: ["conversation-stats", activeAgentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeAgentId) params.set("agentId", activeAgentId);
      const res = await fetch(`/api/conversations/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!activeAgentId,
    refetchInterval: 10000,
  });

  return (
    <div className="flex min-h-svh flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl">Dashboard</h1>
          <p className="text-muted-foreground">
            {activeAgent
              ? `Overview for ${activeAgent.name}`
              : "Overview of your customer support activity"}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="Unresolved" value={stats?.unresolved ?? 0} />
          <StatCard label="Escalated" value={stats?.escalated ?? 0} />
          <StatCard label="Resolved" value={stats?.resolved ?? 0} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
