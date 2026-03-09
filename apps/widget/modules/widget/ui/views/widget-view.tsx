"use client";

import { useAtomValue } from "jotai";
import { WidgetAuthScreen } from "@/modules/widget/ui/screens/widget-auth-screen";
import { screenAtom, widgetSettingsAtom } from "@/modules/widget/atoms/widget-atoms";
import { WidgetErrorScreen } from "@/modules/widget/ui/screens/widget-error-screen";
import { WidgetLoadingScreen } from "@/modules/widget/ui/screens/widget-loading-screen";
import { WidgetChatScreen } from "@/modules/widget/ui/screens/widget-chat-screen";
import { WidgetInboxScreen } from "../screens/widget-inbox-screen";
import { useMemo } from "react";

interface Props {
  organizationId: string | null;
  agentId: string | null;
};

export const WidgetView = ({ organizationId, agentId }: Props) => {
  const screen = useAtomValue(screenAtom);
  const widgetSettings = useAtomValue(widgetSettingsAtom);

  const themeStyle = useMemo(() => {
    if (!widgetSettings?.themeColor) return undefined;
    return { "--primary": widgetSettings.themeColor } as React.CSSProperties;
  }, [widgetSettings?.themeColor]);

  const screenComponents = {
    loading: <WidgetLoadingScreen organizationId={organizationId} agentId={agentId} />,
    error: <WidgetErrorScreen />,
    auth: <WidgetAuthScreen />,
    inbox: <WidgetInboxScreen />,
    chat: <WidgetChatScreen />,
  }

  return (
    <main
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-muted"
      style={themeStyle}
    >
      {screenComponents[screen]}
    </main>
  );
};
