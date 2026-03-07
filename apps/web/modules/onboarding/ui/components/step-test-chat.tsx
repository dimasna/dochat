"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { BotIcon, Loader2Icon, SendIcon } from "lucide-react";
import type { WidgetSettingsData } from "../views/onboarding-view";

interface StepTestChatProps {
  widgetSettings: WidgetSettingsData;
}

export const StepTestChat = ({ widgetSettings }: StepTestChatProps) => {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);

  const suggestions = [
    widgetSettings.suggestion1,
    widgetSettings.suggestion2,
    widgetSettings.suggestion3,
  ].filter(Boolean) as string[];

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
        <h2 className="text-xl font-semibold">Review & Launch</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Review your widget preview below. Click &quot;Complete Setup&quot; to
          provision your AI agent.
        </p>
      </div>

      {/* Widget preview */}
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border bg-muted overflow-hidden shadow-lg">
          {/* Header */}
          <div className="bg-primary px-4 py-5 text-primary-foreground">
            <p className="text-xl font-semibold">Hi there! 👋</p>
            <p className="text-sm opacity-90">
              {widgetSettings.agentName}
            </p>
          </div>

          {/* Chat area */}
          <div className="bg-background p-4 min-h-[200px] space-y-3">
            {/* Greeting message */}
            <div className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <BotIcon className="size-4 text-primary" />
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm max-w-[80%]">
                {widgetSettings.greetMessage}
              </div>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-col items-end gap-1.5 pt-2">
                {suggestions.map((s) => (
                  <div
                    key={s}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t bg-background px-3 py-2 flex items-center gap-2">
            <div className="flex-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Type your message...
            </div>
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <SendIcon className="size-3.5" />
            </div>
          </div>
        </div>
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
