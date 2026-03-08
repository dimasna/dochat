"use client";

import { Progress } from "@workspace/ui/components/progress";

interface UsageData {
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

function formatLimit(value: number | null) {
  return value == null ? "Unlimited" : value.toString();
}

function UsageBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number | null;
}) {
  const isUnlimited = max == null;
  const percentage = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isNearLimit ? "font-medium text-orange-600" : ""}>
          {current} / {formatLimit(max)}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={isNearLimit ? "[&>div]:bg-orange-500" : ""}
        />
      )}
    </div>
  );
}

export function UsageDisplay({ data }: { data: UsageData }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Current Usage</h3>
      <div className="space-y-3">
        <UsageBar
          label="Agents"
          current={data.usage.agents}
          max={data.limits.maxAgents}
        />
        <UsageBar
          label="Knowledge Bases"
          current={data.usage.knowledgeBases}
          max={data.limits.maxKnowledgeBases}
        />
        <UsageBar
          label="Message credits this month"
          current={data.usage.messageCreditsThisMonth}
          max={data.limits.maxMessageCreditsPerMonth}
        />
      </div>
    </div>
  );
}
