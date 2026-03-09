"use client";

import { useEffect, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { contactSessionAtomFamily, errorMessageAtom, loadingMessageAtom, organizationIdAtom, screenAtom, widgetSettingsAtom, agentIdAtom } from "@/modules/widget/atoms/widget-atoms";
import { api } from "@/lib/api";

type InitStep = "org" | "session" | "settings" | "done";

export const WidgetLoadingScreen = ({ organizationId, agentId }: { organizationId: string | null; agentId: string | null }) => {
  const [step, setStep] = useState<InitStep>("org")
  const [sessionValid, setSessionValid] = useState(false);

  const setWidgetSettings = useSetAtom(widgetSettingsAtom);
  const setOrganizationId = useSetAtom(organizationIdAtom);
  const setAgentId = useSetAtom(agentIdAtom);
  const setLoadingMessage = useSetAtom(loadingMessageAtom);
  const setErrorMessage = useSetAtom(errorMessageAtom);
  const setScreen = useSetAtom(screenAtom);

  const contactSession = useAtomValue(contactSessionAtomFamily(organizationId || ""));

  // Step 1: Validate organization
  useEffect(() => {
    if (step !== "org") return;

    if (!organizationId) {
      setErrorMessage("Organization ID is required");
      setScreen("error");
      return;
    }

    api.validateOrg(organizationId, agentId ?? undefined)
      .then((result) => {
        if (result.valid) {
          setOrganizationId(organizationId);
          if (agentId) setAgentId(agentId);
          setStep("session");
        } else {
          setErrorMessage(result.reason || "Invalid configuration");
          setScreen("error");
        }
      })
      .catch(() => {
        setErrorMessage("Unable to verify organization");
        setScreen("error");
      });
  }, [step, organizationId, agentId, setErrorMessage, setScreen, setOrganizationId, setAgentId, setLoadingMessage]);

  // Step 2: Validate session (if exists)
  useEffect(() => {
    if (step !== "session") return;

    if (!contactSession?.sessionId) {
      setSessionValid(false);
      setStep("settings");
      return;
    }

    api.validateSession(contactSession.sessionId)
      .then((result) => {
        setSessionValid(result.valid);
        setStep("settings");
      })
      .catch(() => {
        setSessionValid(false);
        setStep("settings");
      });
  }, [step, contactSession, setLoadingMessage]);

  // Step 3: Load Widget Settings
  useEffect(() => {
    if (step !== "settings") return;
    if (!organizationId) return;

    api.getConfig(organizationId, agentId ?? undefined)
      .then((settings) => {
        if (settings) {
          setWidgetSettings(settings);
        }
        setStep("done");
      })
      .catch(() => {
        setStep("done");
      });
  }, [step, organizationId, agentId, setWidgetSettings, setLoadingMessage]);

  // Step 4: Navigate — go to chat if session valid, else auth
  useEffect(() => {
    if (step !== "done") return;

    const hasValidSession = contactSession?.sessionId && sessionValid;
    if (!hasValidSession) {
      setScreen("auth");
      return;
    }

    // Go straight to chat — conversation will be created on first message
    setScreen("chat");
  }, [step, contactSession, sessionValid, setScreen]);

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
};
