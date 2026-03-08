"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { Textarea } from "@workspace/ui/components/textarea";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  ArrowLeftIcon,
  BotIcon,
  CopyIcon,
  FolderIcon,
  Loader2Icon,
  PenIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useOrgEvents } from "@/hooks/use-org-events";

interface AgentKb {
  id: string;
  knowledgeBase: {
    id: string;
    name: string;
    indexingStatus: string;
    _count: { sources: number };
  };
}

interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  instruction: string | null;
  status: string;
  widgetSettings: {
    greetMessage: string;
    suggestion1: string | null;
    suggestion2: string | null;
    suggestion3: string | null;
  } | null;
  knowledgeBases: AgentKb[];
  _count: { conversations: number };
}

const WIDGET_BASE_URL = process.env.NEXT_PUBLIC_WIDGET_URL || "https://your-dochat-widget.ondigitalocean.app";

export const AgentDetailView = ({ agentId }: { agentId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: agent, isLoading } = useQuery<AgentDetail>({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}`);
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
  });

  // Real-time updates via SSE
  useOrgEvents((event) => {
    if (event.type === "agent:status" && event.id === agentId) {
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    }
  });

  // Fetch org-level knowledge bases for attaching
  const { data: orgKbs = [] } = useQuery<Array<{
    id: string;
    name: string;
    indexingStatus: string;
    _count: { sources: number };
  }>>({
    queryKey: ["knowledge-bases"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const isProvisioning = agent?.status === "provisioning";

  const handleDelete = async () => {
    if (!confirm("Delete this agent? This will remove the agent, its workspace, and knowledge base from DigitalOcean.")) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete agent");
      toast.success("Agent deleted");
      router.push("/workspace");
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAttachKb = async (knowledgeBaseId: string) => {
    setIsAttaching(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge-bases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseIds: [knowledgeBaseId] }),
      });
      if (!res.ok) throw new Error("Failed to attach knowledge base");
      toast.success("Knowledge base attached. Agent is re-provisioning.");
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    } catch {
      toast.error("Failed to attach knowledge base");
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetachKb = async (knowledgeBaseId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge-bases`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId }),
      });
      if (!res.ok) throw new Error("Failed to detach knowledge base");
      toast.success("Knowledge base removed from agent");
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    } catch {
      toast.error("Failed to remove knowledge base");
    }
  };

  const handleCopyEmbedCode = async () => {
    const code = `<script src="${WIDGET_BASE_URL}/widget.js" data-organization-id="ORG_ID" data-agent-id="${agentId}"></script>`;
    await navigator.clipboard.writeText(code);
    toast.success("Embed code copied!");
  };

  const handleStartEdit = () => {
    if (!agent) return;
    setEditName(agent.name);
    setEditInstruction(agent.instruction || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          instruction: editInstruction.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update agent");
      toast.success("Agent updated");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    } catch {
      toast.error("Failed to update agent");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-8">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  const attachedKbIds = new Set(agent.knowledgeBases.map((akb) => akb.knowledgeBase.id));
  const unattachedKbs = orgKbs.filter(
    (kb) => !attachedKbIds.has(kb.id) && kb.indexingStatus === "ready",
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted p-8">
      <div className="mx-auto w-full max-w-screen-md">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Agents
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <BotIcon className="size-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{agent.name}</h1>
                  <Badge
                    variant={agent.status === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {agent.status === "provisioning" && (
                      <Loader2Icon className="size-3 mr-1 animate-spin" />
                    )}
                    {agent.status}
                  </Badge>
                </div>
                {agent.description && (
                  <p className="text-muted-foreground text-sm">{agent.description}</p>
                )}
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <TrashIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Provisioning banner */}
        {isProvisioning && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 px-4 py-3 mb-6">
            <div className="flex items-center gap-2">
              <Loader2Icon className="size-4 animate-spin text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Agent is being provisioned on DigitalOcean. Knowledge base management will be available once the agent is active.
              </p>
            </div>
          </div>
        )}

        {/* Agent Settings */}
        <div className="rounded-lg border bg-background p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Agent Settings</h2>
            {!isEditing && !isProvisioning && (
              <Button size="sm" variant="outline" onClick={handleStartEdit}>
                <PenIcon className="size-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-instruction">Instruction</Label>
                <Textarea
                  id="edit-instruction"
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Custom instructions that define how your agent behaves and responds."
                  rows={5}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim()}
                >
                  {isSaving ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm">{agent.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Instruction</p>
                <p className="text-sm whitespace-pre-wrap">
                  {agent.instruction || <span className="text-muted-foreground italic">No instruction set</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Integration Code */}
        <div className="rounded-lg border bg-background p-5 mb-6">
          <h2 className="font-semibold mb-3">Integration</h2>
          <div className="flex items-center gap-2">
            <Label className="shrink-0">Agent ID</Label>
            <Input
              readOnly
              value={agent.id}
              className="font-mono text-sm bg-muted"
            />
            <Button size="sm" variant="outline" onClick={handleCopyEmbedCode}>
              <CopyIcon className="size-4 mr-1" />
              Copy Embed
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Knowledge Bases */}
        <div className="rounded-lg border bg-background p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Knowledge Bases</h2>
          </div>

          {/* Attached knowledge bases */}
          {agent.knowledgeBases.length > 0 && (
            <div className="divide-y rounded-lg border mb-4">
              {agent.knowledgeBases.map((agentKb) => (
                <div key={agentKb.id} className="flex items-center gap-3 px-4 py-3">
                  <FolderIcon className="size-4 shrink-0 text-primary" />
                  <span className="flex-1 text-sm truncate">
                    {agentKb.knowledgeBase.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {agentKb.knowledgeBase._count.sources} source{agentKb.knowledgeBase._count.sources !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleDetachKb(agentKb.knowledgeBase.id)}
                    disabled={isProvisioning}
                  >
                    <TrashIcon className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {agent.knowledgeBases.length === 0 && (
            <p className="text-muted-foreground text-sm mb-4">
              No knowledge bases attached.{!isProvisioning && " Attach knowledge bases below."}
            </p>
          )}

          {/* Available org KBs to attach */}
          {!isProvisioning && unattachedKbs.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Available knowledge bases ({unattachedKbs.length}):
              </p>
              <div className="divide-y rounded-lg border">
                {unattachedKbs.map((kb) => (
                  <div key={kb.id} className="flex items-center gap-3 px-4 py-3">
                    <FolderIcon className="size-4 shrink-0 text-primary" />
                    <span className="flex-1 text-sm truncate">{kb.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {kb._count.sources} source{kb._count.sources !== 1 ? "s" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAttachKb(kb.id)}
                      disabled={isAttaching}
                    >
                      Attach
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold mb-3">Stats</h2>
          <div className="text-sm text-muted-foreground">
            <p>{agent._count.conversations} conversation{agent._count.conversations !== 1 ? "s" : ""}</p>
            <p>{agent.knowledgeBases.length} knowledge base{agent.knowledgeBases.length !== 1 ? "s" : ""} attached</p>
          </div>
        </div>
      </div>
    </div>
  );
};
