"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PricingTable } from "../components/pricing-table";
import { UsageDisplay } from "../components/usage-display";

interface BillingUsage {
  plan: string;
  status: string;
  hasSubscription: boolean;
  usage: {
    agents: number;
    knowledgeBases: number;
    messageCreditsThisMonth: number;
  };
  limits: {
    maxAgents: number | null;
    maxKnowledgeBases: number | null;
    maxMessageCreditsPerMonth: number | null;
    maxSourcesPerKb: number | null;
  };
}

export const BillingView = () => {
  const { data, isLoading } = useQuery<BillingUsage>({
    queryKey: ["billing-usage"],
    queryFn: async () => {
      const res = await fetch("/api/billing/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background p-8">
      <div className="mx-auto w-full max-w-screen-xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Plans & Billing</h1>
          <p className="text-muted-foreground">
            Choose the plan that&apos;s right for you
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : data ? (
          <>
            <div className="mt-8 rounded-lg border bg-card p-6">
              <UsageDisplay data={data} />
            </div>
            <div className="mt-8">
              <PricingTable
                currentPlan={data.plan}
                hasSubscription={data.hasSubscription}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
