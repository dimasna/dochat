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
import { CheckIcon } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Get started with basic support",
    features: ["1 team member", "100 conversations/mo", "Basic AI responses"],
    current: true,
  },
  {
    name: "Pro",
    price: "$29",
    description: "For growing teams",
    features: [
      "Unlimited team members",
      "Unlimited conversations",
      "Advanced AI with knowledge base",
      "File uploads",
      "Priority support",
    ],
    current: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "SSO / SAML",
    ],
    current: false,
  },
];

export const PricingTable = () => {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.name} className="flex flex-col">
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
            <p className="mt-2 text-3xl font-bold">
              {plan.price}
              {plan.price !== "Custom" && (
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <CheckIcon className="size-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={plan.current ? "outline" : "default"}
              disabled={plan.current}
            >
              {plan.current ? "Current Plan" : "Upgrade"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
