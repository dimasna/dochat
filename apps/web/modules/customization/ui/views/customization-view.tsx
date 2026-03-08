"use client";

import { useActiveAgent } from "@/hooks/use-active-agent";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { CustomizationForm } from "../components/customization-form";

export const CustomizationView = () => {
  const { activeAgentId } = useActiveAgent();

  const { data: widgetSettings, isLoading } = useQuery({
    queryKey: ["widget-settings", activeAgentId],
    queryFn: async () => {
      const res = await fetch(`/api/widget-settings?agentId=${activeAgentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{
        agentId: string;
        greetMessage?: string;
        suggestion1?: string | null;
        suggestion2?: string | null;
        suggestion3?: string | null;
        themeColor?: string | null;
        widgetLogo?: string | null;
      }>;
    },
    enabled: !!activeAgentId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-y-2 bg-muted p-8">
        <Loader2Icon className="text-muted-foreground animate-spin" />
        <p className="text-muted-foreground text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl">Widget Customization</h1>
          <p className="text-muted-foreground">
            Customize how your chat widget looks and behaves for your customers
          </p>
        </div>

        <div className="mt-8">
          <CustomizationForm
            agentId={activeAgentId ?? widgetSettings?.agentId}
            initialData={widgetSettings}
          />
        </div>
      </div>
    </div>
  );
};
