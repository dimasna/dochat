"use client";

import { useEffect } from "react";
import { LoaderIcon } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { contactSessionAtomFamily, organizationIdAtom, screenAtom } from "../../atoms/widget-atoms";
import { api } from "@/lib/api";

export const WidgetAuthScreen = () => {
  const setScreen = useSetAtom(screenAtom);

  const organizationId = useAtomValue(organizationIdAtom);
  const setContactSession = useSetAtom(
    contactSessionAtomFamily(organizationId || "")
  );

  // Auto-create anonymous session only (conversation created on first message)
  useEffect(() => {
    if (!organizationId) return;

    const metadata = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages?.join(","),
      platform: navigator.platform,
      vendor: navigator.vendor,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      cookieEnabled: navigator.cookieEnabled,
      referrer: document.referrer || "direct",
      currentUrl: window.location.href,
    };

    api.createSession({
      orgId: organizationId,
      name: "Visitor",
      email: "visitor@anonymous.widget",
      metadata,
    })
      .then((result) => {
        setContactSession({
          sessionId: result.sessionId,
          sessionToken: result.sessionToken,
        });
        setScreen("chat");
      })
      .catch(() => {
        setScreen("error");
      });
  }, [organizationId, setContactSession, setScreen]);

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
};
