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
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  Loader2Icon,
  PenIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { UploadDialog } from "@/modules/files/ui/components/upload-dialog";

interface AgentDoc {
  id: string;
  status: string;
  document: {
    id: string;
    title: string;
    sourceType: string;
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
  documents: AgentDoc[];
  _count: { conversations: number };
}

const WIDGET_BASE_URL = process.env.NEXT_PUBLIC_WIDGET_URL || "https://your-dochat-widget.ondigitalocean.app";

function SourceIcon({ type }: { type: string }) {
  switch (type) {
    case "website":
      return <GlobeIcon className="size-4 shrink-0" />;
    case "text":
      return <FileTextIcon className="size-4 shrink-0" />;
    default:
      return <FileIcon className="size-4 shrink-0" />;
  }
}

export const AgentDetailView = ({ agentId }: { agentId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
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

  // Fetch org-level documents for attaching
  const { data: orgDocs = [] } = useQuery<Array<{ id: string; title: string; sourceType: string }>>({
    queryKey: ["knowledge-docs"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleDelete = async () => {
    if (!confirm("Delete this agent? This will remove the agent, its workspace, and knowledge base from DigitalOcean.")) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete agent");
      toast.success("Agent deleted");
      router.push("/agents");
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAttachDoc = async (documentId: string) => {
    setIsAttaching(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [documentId] }),
      });
      if (!res.ok) throw new Error("Failed to attach document");
      toast.success("Document attached and indexing started");
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    } catch {
      toast.error("Failed to attach document");
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetachDoc = async (documentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) throw new Error("Failed to detach document");
      toast.success("Document removed from agent");
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    } catch {
      toast.error("Failed to remove document");
    }
  };

  const handleCopyEmbedCode = async () => {
    const code = `<script src="${WIDGET_BASE_URL}/widget.js" data-organization-id="ORG_ID" data-agent-id="${agentId}"></script>`;
    await navigator.clipboard.writeText(code);
    toast.success("Embed code copied!");
  };

  const handleFileUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
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

  const attachedDocIds = new Set(agent.documents.map((d) => d.document.id));
  const unattachedDocs = orgDocs.filter((d) => !attachedDocIds.has(d.id));

  return (
    <>
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFileUploaded={handleFileUploaded}
      />
      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/agents"
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

          {/* Agent Settings */}
          <div className="rounded-lg border bg-background p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Agent Settings</h2>
              {!isEditing && (
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

          {/* Documents */}
          <div className="rounded-lg border bg-background p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Knowledge Base Documents</h2>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <PlusIcon className="size-4 mr-1" />
                Upload New
              </Button>
            </div>

            {/* Attached documents */}
            {agent.documents.length > 0 && (
              <div className="divide-y rounded-lg border mb-4">
                {agent.documents.map((agentDoc) => (
                  <div key={agentDoc.id} className="flex items-center gap-3 px-4 py-3">
                    <SourceIcon type={agentDoc.document.sourceType} />
                    <span className="flex-1 text-sm truncate">
                      {agentDoc.document.title}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {agentDoc.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleDetachDoc(agentDoc.document.id)}
                    >
                      <TrashIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {agent.documents.length === 0 && (
              <p className="text-muted-foreground text-sm mb-4">
                No documents attached. Upload or attach documents below.
              </p>
            )}

            {/* Available org docs to attach */}
            {unattachedDocs.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Available documents ({unattachedDocs.length}):
                </p>
                <div className="divide-y rounded-lg border">
                  {unattachedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                      <SourceIcon type={doc.sourceType} />
                      <span className="flex-1 text-sm truncate">{doc.title}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAttachDoc(doc.id)}
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
              <p>{agent.documents.length} document{agent.documents.length !== 1 ? "s" : ""} attached</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
