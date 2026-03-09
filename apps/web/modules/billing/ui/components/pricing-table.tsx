"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Get started for free",
    features: [
      "100 message credits/mo",
      "1 AI agent",
      "2 knowledge bases",
      "5 sources per KB",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$30",
    description: "For personal & small projects",
    features: [
      "2,000 message credits/mo",
      "2 AI agents",
      "5 knowledge bases",
      "20 sources per KB",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$129",
    popular: true,
    description: "For scaling businesses",
    features: [
      "10,000 message credits/mo",
      "5 AI agents",
      "10 knowledge bases",
      "50 sources per KB",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: "$450",
    description: "For high-volume teams",
    features: [
      "40,000 message credits/mo",
      "15 AI agents",
      "25 knowledge bases",
      "100 sources per KB",
      "Dedicated support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: [
      "Unlimited message credits",
      "Unlimited agents",
      "Unlimited knowledge bases",
      "Unlimited sources",
      "Dedicated support",
      "Custom integrations",
    ],
  },
];

interface PricingTableProps {
  currentPlan: string;
  hasSubscription: boolean;
}

export const PricingTable = ({
  currentPlan,
  hasSubscription,
}: PricingTableProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start checkout",
      );
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("manage");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.portalUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open portal",
      );
      setLoading(null);
    }
  };

  const mainPlans = plans.filter((p) => p.id !== "enterprise");
  const enterprise = plans.find((p) => p.id === "enterprise")!;
  const isEnterpriseCurrent = currentPlan === "enterprise";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {mainPlans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isUpgrade =
            !isCurrent &&
            plans.findIndex((p) => p.id === plan.id) >
              plans.findIndex((p) => p.id === currentPlan);

          return (
            <Card
              key={plan.id}
              className={`flex flex-col ${"popular" in plan && plan.popular ? "border-primary shadow-md" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                  {"popular" in plan && plan.popular && !isCurrent && (
                    <Badge>Popular</Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="mt-2 text-3xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckIcon className="size-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent && hasSubscription ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={loading === "manage"}
                  >
                    {loading === "manage" && (
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                    )}
                    Manage Subscription
                  </Button>
                ) : isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    Current Plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading === plan.id}
                  >
                    {loading === plan.id && (
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                    )}
                    Upgrade
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    {plan.name}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Enterprise — full width */}
      <Card className="flex flex-col md:flex-row md:items-center md:justify-between">
        <CardHeader className="md:flex-1">
          <div className="flex items-center gap-2">
            <CardTitle>{enterprise.name}</CardTitle>
            {isEnterpriseCurrent && (
              <Badge variant="secondary">Current</Badge>
            )}
          </div>
          <CardDescription>{enterprise.description}</CardDescription>
        </CardHeader>
        <CardContent className="md:flex-1 md:py-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {enterprise.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="md:py-6 md:pr-6">
          {isEnterpriseCurrent ? (
            <Button variant="outline" disabled>
              Current Plan
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <a href="mailto:support@dochat.site">Contact Us</a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
