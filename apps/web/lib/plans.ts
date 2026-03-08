export const PLAN_LIMITS = {
  free: {
    maxAgents: 1,
    maxKnowledgeBases: 2,
    maxSourcesPerKb: 5,
    maxMessageCreditsPerMonth: 100,
  },
  starter: {
    maxAgents: 2,
    maxKnowledgeBases: 5,
    maxSourcesPerKb: 20,
    maxMessageCreditsPerMonth: 2_000,
  },
  growth: {
    maxAgents: 5,
    maxKnowledgeBases: 10,
    maxSourcesPerKb: 50,
    maxMessageCreditsPerMonth: 10_000,
  },
  scale: {
    maxAgents: 15,
    maxKnowledgeBases: 25,
    maxSourcesPerKb: 100,
    maxMessageCreditsPerMonth: 40_000,
  },
  enterprise: {
    maxAgents: Infinity,
    maxKnowledgeBases: Infinity,
    maxSourcesPerKb: Infinity,
    maxMessageCreditsPerMonth: Infinity,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanName] ?? PLAN_LIMITS.free;
}
