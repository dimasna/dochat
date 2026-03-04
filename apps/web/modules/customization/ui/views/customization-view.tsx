"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { CustomizationForm } from "../components/customization-form";

export const CustomizationView = () => {
  const { data: widgetSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["widget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/widget-settings");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: plugins, isLoading: isLoadingPlugins } = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => {
      const res = await fetch("/api/plugins");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const isLoading = isLoadingSettings || isLoadingPlugins;
  const hasVapiPlugin = plugins?.some(
    (p: { service: string; enabled: boolean }) =>
      p.service === "vapi" && p.enabled,
  );

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
            initialData={widgetSettings}
            hasVapiPlugin={!!hasVapiPlugin}
          />
        </div>
      </div>
    </div>
  );
};
