"use client";

import { useQuery } from "@tanstack/react-query";

export default function Page() {
  const { data: stats } = useQuery({
    queryKey: ["conversation-stats"],
    queryFn: async () => {
      const res = await fetch("/api/conversations/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 10000,
  });

  return (
    <div className="flex min-h-svh flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your customer support activity
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
