"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import type { WidgetSettingsData } from "../views/onboarding-view";

interface StepWidgetSettingsProps {
  onComplete: (settings: WidgetSettingsData) => void;
}

export const StepWidgetSettings = ({ onComplete }: StepWidgetSettingsProps) => {
  const [agentName, setAgentName] = useState("Support Agent");
  const [instruction, setInstruction] = useState("");
  const [greetMessage, setGreetMessage] = useState(
    "Hi! How can I help you today?",
  );
  const [suggestion1, setSuggestion1] = useState("");
  const [suggestion2, setSuggestion2] = useState("");
  const [suggestion3, setSuggestion3] = useState("");

  const handleSubmit = () => {
    onComplete({
      agentName: agentName.trim(),
      instruction: instruction.trim(),
      greetMessage,
      suggestion1: suggestion1 || null,
      suggestion2: suggestion2 || null,
      suggestion3: suggestion3 || null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Configure Your Agent</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Set up your AI agent&apos;s name, behavior, and widget appearance.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agentName">Agent Name</Label>
          <Input
            id="agentName"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g., Support Agent"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instruction">
            Instruction <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., You are a friendly customer support agent for Acme Inc. Always be helpful and concise."
            rows={4}
          />
          <p className="text-muted-foreground text-xs">
            Custom instructions that define how your agent behaves and responds.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="greetMessage">Greeting Message</Label>
          <Textarea
            id="greetMessage"
            value={greetMessage}
            onChange={(e) => setGreetMessage(e.target.value)}
            placeholder="Welcome message shown when chat opens"
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <Label>Quick Reply Suggestions</Label>
          <Input
            value={suggestion1}
            onChange={(e) => setSuggestion1(e.target.value)}
            placeholder="e.g., How do I get started?"
          />
          <Input
            value={suggestion2}
            onChange={(e) => setSuggestion2(e.target.value)}
            placeholder="e.g., What are your pricing plans?"
          />
          <Input
            value={suggestion3}
            onChange={(e) => setSuggestion3(e.target.value)}
            placeholder="e.g., I need help with my account"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!agentName.trim() || !greetMessage.trim()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
