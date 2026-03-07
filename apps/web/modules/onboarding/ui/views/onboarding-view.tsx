"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { StepWidgetSettings } from "../components/step-widget-settings";
import { StepKnowledgeBase } from "../components/step-knowledge-base";
import { StepIntegration } from "../components/step-integration";
import { StepTestChat } from "../components/step-test-chat";

export interface WidgetSettingsData {
  agentName: string;
  instruction: string;
  greetMessage: string;
  suggestion1: string | null;
  suggestion2: string | null;
  suggestion3: string | null;
}

const STEPS = [
  { label: "Widget Settings", description: "Configure your chat widget" },
  { label: "Knowledge Base", description: "Add knowledge sources" },
  { label: "Integration", description: "Add to your website" },
  { label: "Review & Launch", description: "Review and provision your agent" },
];

export const OnboardingView = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettingsData>({
    agentName: "Support Agent",
    instruction: "",
    greetMessage: "Hi! How can I help you today?",
    suggestion1: null,
    suggestion2: null,
    suggestion3: null,
  });

  const goToNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md">
        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold">
            Welcome to Dochat
          </h1>
          <p className="text-muted-foreground mt-1">
            Let&apos;s set up your AI support agent in a few steps.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      index < currentStep
                        ? "bg-primary text-primary-foreground"
                        : index === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        index <= currentStep
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 mx-2 ${
                      index < currentStep ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-lg border bg-background p-6">
          {currentStep === 0 && (
            <StepWidgetSettings
              onComplete={(settings) => {
                setWidgetSettings(settings);
                goToNext();
              }}
            />
          )}
          {currentStep === 1 && (
            <StepKnowledgeBase onComplete={goToNext} />
          )}
          {currentStep === 2 && <StepIntegration onComplete={goToNext} />}
          {currentStep === 3 && <StepTestChat widgetSettings={widgetSettings} />}
        </div>
      </div>
    </div>
  );
};
