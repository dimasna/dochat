"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { toast } from "sonner";
import { FileIcon, FileTextIcon, GlobeIcon, Loader2Icon } from "lucide-react";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrgDoc {
  id: string;
  title: string;
  sourceType: string;
}

function SourceIcon({ type }: { type: string }) {
  switch (type) {
    case "website":
      return <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />;
    case "text":
      return <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />;
    default:
      return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
}

export const CreateAgentDialog = ({ open, onOpenChange }: CreateAgentDialogProps) => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const { data: orgDocs = [] } = useQuery<OrgDoc[]>({
    queryKey: ["knowledge-docs"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open,
  });

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          instruction: instruction.trim() || undefined,
          documentIds: selectedDocIds.size > 0 ? Array.from(selectedDocIds) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create agent");
      }

      toast.success("Agent created! It will be ready shortly.");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setName("");
      setDescription("");
      setInstruction("");
      setSelectedDocIds(new Set());
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create agent";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Create a new AI support agent with its own knowledge base and workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Sales Support"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">Description (optional)</Label>
            <Textarea
              id="agent-description"
              placeholder="What does this agent do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-instruction">Instruction (optional)</Label>
            <Textarea
              id="agent-instruction"
              placeholder="e.g., You are a friendly customer support agent for Acme Inc. Always be helpful and concise."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={4}
            />
            <p className="text-muted-foreground text-xs">
              Custom instructions that define how your agent behaves and responds.
            </p>
          </div>

          {/* Knowledge Base Documents */}
          {orgDocs.length > 0 && (
            <div className="space-y-2">
              <Label>Knowledge Base (optional)</Label>
              <p className="text-muted-foreground text-xs">
                Select documents to attach to this agent&apos;s knowledge base.
              </p>
              <div className="divide-y rounded-lg border max-h-48 overflow-y-auto">
                {orgDocs.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedDocIds.has(doc.id)}
                      onCheckedChange={() => toggleDoc(doc.id)}
                    />
                    <SourceIcon type={doc.sourceType} />
                    <span className="flex-1 text-sm truncate">{doc.title}</span>
                  </label>
                ))}
              </div>
              {selectedDocIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDocIds.size} document{selectedDocIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
              {isCreating ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Agent"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
