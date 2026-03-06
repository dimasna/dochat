"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CopyIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  INTEGRATIONS,
  type IntegrationId,
} from "@/modules/integrations/constants";
import { createScript } from "@/modules/integrations/utils";

interface StepIntegrationProps {
  onComplete: () => void;
}

export const StepIntegration = ({ onComplete }: StepIntegrationProps) => {
  const { organization } = useOrganization();
  const [selectedId, setSelectedId] = useState<IntegrationId | null>(null);
  const [copied, setCopied] = useState(false);

  const snippet =
    selectedId && organization
      ? createScript(selectedId, organization.id, "YOUR_AGENT_ID")
      : "";

  const handleCopyOrgId = async () => {
    if (!organization) return;
    await navigator.clipboard.writeText(organization.id);
    toast.success("Organization ID copied");
  };

  const handleCopySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add to Your Website</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Copy the integration code and add it to your website to enable the
          chat widget.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Organization ID</Label>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={organization?.id ?? ""}
            className="font-mono text-sm bg-muted"
          />
          <Button size="icon" variant="outline" onClick={handleCopyOrgId}>
            <CopyIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Choose your framework</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {INTEGRATIONS.map((integration) => (
            <button
              key={integration.id}
              type="button"
              onClick={() => setSelectedId(integration.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                selectedId === integration.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              }`}
            >
              <Image
                alt={integration.title}
                height={24}
                src={integration.icon}
                width={24}
              />
              <span className="text-sm">{integration.title}</span>
            </button>
          ))}
        </div>
      </div>

      {snippet && (
        <div className="space-y-2">
          <Label>Integration code</Label>
          <div className="group relative">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-foreground p-3 font-mono text-secondary text-sm">
              {snippet}
            </pre>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 size-7"
              onClick={handleCopySnippet}
            >
              {copied ? (
                <CheckIcon className="size-3" />
              ) : (
                <CopyIcon className="size-3" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onComplete}>Next</Button>
      </div>
    </div>
  );
};
