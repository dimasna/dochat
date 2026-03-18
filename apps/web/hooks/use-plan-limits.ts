import { useQuery } from "@tanstack/react-query";

interface PlanLimitsData {
  plan: string;
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

export function usePlanLimits() {
  const { data } = useQuery<PlanLimitsData>({
    queryKey: ["billing-usage"],
    queryFn: async () => {
      const res = await fetch("/api/billing/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    staleTime: 30_000,
  });

  return {
    plan: data?.plan ?? "free",
    usage: data?.usage ?? { agents: 0, knowledgeBases: 0, messageCreditsThisMonth: 0 },
    limits: data?.limits ?? { maxAgents: null, maxKnowledgeBases: null, maxMessageCreditsPerMonth: null, maxSourcesPerKb: null },
    canCreateAgent: data ? (data.limits.maxAgents == null || data.usage.agents < data.limits.maxAgents) : true,
    canCreateKb: data ? (data.limits.maxKnowledgeBases == null || data.usage.knowledgeBases < data.limits.maxKnowledgeBases) : true,
    canAddSource: (currentCount: number) =>
      data ? (data.limits.maxSourcesPerKb == null || currentCount < data.limits.maxSourcesPerKb) : true,
  };
}
