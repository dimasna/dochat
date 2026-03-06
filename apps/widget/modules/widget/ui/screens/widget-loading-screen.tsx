"use client";

import { useEffect, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { agentIdAtom, contactSessionAtomFamily, errorMessageAtom, loadingMessageAtom, organizationIdAtom, screenAtom, widgetSettingsAtom } from "@/modules/widget/atoms/widget-atoms";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { api } from "@/lib/api";

type InitStep = "org" | "session" | "settings" | "done";

export const WidgetLoadingScreen = ({ organizationId, agentId }: { organizationId: string | null; agentId: string | null }) => {
  const [step, setStep] = useState<InitStep>("org")
  const [sessionValid, setSessionValid] = useState(false);

  const loadingMessage = useAtomValue(loadingMessageAtom);
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

    setLoadingMessage("Finding organization ID...");

    if (!organizationId) {
      setErrorMessage("Organization ID is required");
      setScreen("error");
      return;
    }

    setLoadingMessage("Verifying organization...");

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

    setLoadingMessage("Finding contact session...");

    if (!contactSession?.sessionId) {
      setSessionValid(false);
      setStep("settings");
      return;
    }

    setLoadingMessage("Validating session...");

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

    setLoadingMessage("Loading widget settings...");

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

  // Step 4: Navigate to appropriate screen
  useEffect(() => {
    if (step !== "done") return;

    const hasValidSession = contactSession?.sessionId && sessionValid;
    setScreen(hasValidSession ? "selection" : "auth");
  }, [step, contactSession, sessionValid, setScreen]);

  return (
    <>
      <WidgetHeader>
        <div className="flex flex-col justify-between gap-y-2 px-2 py-6 font-semibold">
          <p className="text-3xl">
            Hi there! 👋
          </p>
          <p className="text-lg">
            Let&apos;s get you started
          </p>
        </div>
      </WidgetHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-y-4 p-4 text-muted-foreground">
        <LoaderIcon className="animate-spin" />
        <p className="text-sm">
         {loadingMessage || "Loading..."}
        </p>
      </div>
    </>
  );
};
