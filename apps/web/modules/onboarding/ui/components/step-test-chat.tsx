"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import type { WidgetSettingsData } from "../views/onboarding-view";

const WIDGET_URL =
  process.env.NEXT_PUBLIC_WIDGET_URL || "http://localhost:3006";

interface StepTestChatProps {
  widgetSettings: WidgetSettingsData;
}

export const StepTestChat = ({ widgetSettings }: StepTestChatProps) => {
  const { organization } = useOrganization();
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: widgetSettings.agentName,
          instruction: widgetSettings.instruction || undefined,
          greetMessage: widgetSettings.greetMessage,
          suggestion1: widgetSettings.suggestion1,
          suggestion2: widgetSettings.suggestion2,
          suggestion3: widgetSettings.suggestion3,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to complete setup");
      }

      toast.success("Setup complete! Your AI agent is being provisioned.");
      router.push("/conversations");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to complete setup";
      toast.error(message);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Test Your Chat Widget</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Preview your widget below. When you&apos;re ready, complete the setup
          to provision your AI agent.
        </p>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <iframe
          src={`${WIDGET_URL}?organizationId=${organization?.id ?? ""}`}
          className="w-full h-[500px] border-0"
          title="Chat widget preview"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleComplete} disabled={isCompleting}>
          {isCompleting ? (
            <>
              <Loader2Icon className="size-4 mr-2 animate-spin" />
              Provisioning Agent...
            </>
          ) : (
            "Complete Setup"
          )}
        </Button>
      </div>
    </div>
  );
};
