"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PenIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { UploadDialog } from "../components/upload-dialog";
import { useState } from "react";
import { DeleteFileDialog } from "../components/delete-file-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgEvents } from "@/hooks/use-org-events";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useRouter } from "next/navigation";

interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: "file" | "website" | "text";
  fileName?: string | null;
  sourceUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  indexingStatus: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  indexingStatus: string;
  sources: KnowledgeSource[];
  _count: { sources: number };
}

interface KnowledgeBasesResponse {
  knowledgeBases: KnowledgeBase[];
  dbProvisioning: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const isProcessing = ["pending", "creating", "indexing"].includes(status);
  const variant = status === "ready" ? "default" : status === "failed" ? "destructive" : "secondary";

  return (
    <Badge variant={variant} className="text-xs capitalize">
      {isProcessing && <Loader2Icon className="size-3 mr-1 animate-spin" />}
      {status}
    </Badge>
  );
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function getTotalSize(sources: KnowledgeSource[]) {
  return sources.reduce((sum, s) => sum + (s.fileSize || 0), 0);
}

export const FilesView = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { canCreateKb, canAddSource } = usePlanLimits();

  const { data, isLoading } = useQuery<KnowledgeBasesResponse>({
    queryKey: ["knowledge-bases"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const knowledgeBases = data?.knowledgeBases ?? [];
  const dbProvisioning = data?.dbProvisioning ?? false;

  // Real-time updates via SSE
  useOrgEvents((event) => {
    if (event.type === "kb:status" || event.type === "kb:source:status") {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadKbId, setUploadKbId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [deleteSourceDialogOpen, setDeleteSourceDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{ source: KnowledgeSource; kbId: string } | null>(null);
  const [expandedKbs, setExpandedKbs] = useState<Set<string>>(new Set());
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameKb, setRenameKb] = useState<KnowledgeBase | null>(null);
  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleExpanded = (kbId: string) => {
    setExpandedKbs((prev) => {
      const next = new Set(prev);
      if (next.has(kbId)) next.delete(kbId);
      else next.add(kbId);
      return next;
    });
  };

  const handleDeleteKb = (kb: KnowledgeBase) => {
    setSelectedKb(kb);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSource = (source: KnowledgeSource, kbId: string) => {
    setSelectedSource({ source, kbId });
    setDeleteSourceDialogOpen(true);
  };

  const handleAddSource = (kbId: string) => {
    setUploadKbId(kbId);
    setUploadDialogOpen(true);
  };

  const handleRename = (kb: KnowledgeBase) => {
    setRenameKb(kb);
    setRenameName(kb.name);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameKb || !renameName.trim()) return;
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${renameKb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      setRenameDialogOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const newKb = await res.json();

      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      setCreateDialogOpen(false);
      setCreateName("");
      // Auto-open upload dialog for the new KB
      setUploadKbId(newKb.id);
      setUploadDialogOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKbDeleted = () => {
    setSelectedKb(null);
    queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
  };

  const handleSourceDeleted = () => {
    setSelectedSource(null);
    queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
  };

  return (
    <>
      {/* Create KB Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kb-name">Name</Label>
            <Input
              id="kb-name"
              placeholder="e.g., Product Documentation"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={isCreating || !createName.trim()}>
              {isCreating ? <Loader2Icon className="size-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename KB Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-kb">Name</Label>
            <Input
              id="rename-kb"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={isRenaming || !renameName.trim()}>
              {isRenaming ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete KB Dialog */}
      <DeleteFileDialog
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        mode="kb"
        kb={selectedKb}
        onDeleted={handleKbDeleted}
      />

      {/* Delete Source Dialog */}
      <DeleteFileDialog
        onOpenChange={setDeleteSourceDialogOpen}
        open={deleteSourceDialogOpen}
        mode="source"
        source={selectedSource?.source ?? null}
        kbId={selectedSource?.kbId}
        onDeleted={handleSourceDeleted}
      />

      {/* Upload / Add Source Dialog */}
      <UploadDialog
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) setUploadKbId(null);
        }}
        open={uploadDialogOpen}
        knowledgeBaseId={uploadKbId}
      />

      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Organize knowledge sources into folders for your AI assistant
            </p>
          </div>

          {dbProvisioning && (
            <div className="mt-8 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              <Loader2Icon className="size-4 shrink-0 animate-spin" />
              <p>
                Database is being provisioned. You can add more sources once the
                current indexing completes.
              </p>
            </div>
          )}

          <div className={`${dbProvisioning ? "mt-4" : "mt-8"} rounded-lg border bg-background`}>
            <div className="flex items-center justify-end border-b px-6 py-4">
              {canCreateKb ? (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <PlusIcon />
                  New Knowledge Base
                </Button>
              ) : (
                <Button variant="outline" onClick={() => router.push("/billing")}>
                  <ArrowUpRightIcon className="size-4 mr-2" />
                  Upgrade to add more
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-4 font-medium w-8"></TableHead>
                  <TableHead className="px-6 py-4 font-medium">Name</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Sources</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Status</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Size</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={6}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : knowledgeBases.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={6}>
                      No knowledge bases yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  knowledgeBases.map((kb) => {
                    const isExpanded = expandedKbs.has(kb.id);
                    const sourceAllowed = canAddSource(kb._count.sources) && !dbProvisioning;
                    return (
                      <KbRow
                        key={kb.id}
                        kb={kb}
                        isExpanded={isExpanded}
                        canAddSource={sourceAllowed}
                        onToggle={() => toggleExpanded(kb.id)}
                        onRename={() => handleRename(kb)}
                        onAddSource={() => handleAddSource(kb.id)}
                        onUpgrade={() => router.push("/billing")}
                        onDelete={() => handleDeleteKb(kb)}
                        onDeleteSource={(source) => handleDeleteSource(source, kb.id)}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

function KbRow({
  kb,
  isExpanded,
  canAddSource,
  onToggle,
  onRename,
  onAddSource,
  onUpgrade,
  onDelete,
  onDeleteSource,
}: {
  kb: KnowledgeBase;
  isExpanded: boolean;
  canAddSource: boolean;
  onToggle: () => void;
  onRename: () => void;
  onAddSource: () => void;
  onUpgrade: () => void;
  onDelete: () => void;
  onDeleteSource: (source: KnowledgeSource) => void;
}) {
  return (
    <>
      {/* KB folder row */}
      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={onToggle}>
        <TableCell className="px-6 py-4 w-8">
          {isExpanded ? (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="px-6 py-4">
          <div className="flex items-center gap-3">
            <FolderIcon className="size-4 shrink-0 text-primary" />
            <span className="font-medium">{kb.name}</span>
          </div>
        </TableCell>
        <TableCell className="px-6 py-4">
          <Badge variant="outline">{kb._count.sources} source{kb._count.sources !== 1 ? "s" : ""}</Badge>
        </TableCell>
        <TableCell className="px-6 py-4">
          <StatusBadge status={kb.indexingStatus} />
        </TableCell>
        <TableCell className="px-6 py-4 text-muted-foreground">
          {formatFileSize(getTotalSize(kb.sources))}
        </TableCell>
        <TableCell className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="size-8 p-0" size="sm" variant="ghost">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canAddSource ? (
                <DropdownMenuItem onClick={onAddSource}>
                  <PlusIcon className="size-4 mr-2" />
                  Add Source
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onUpgrade}>
                  <ArrowUpRightIcon className="size-4 mr-2" />
                  Upgrade to add more
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onRename}>
                <PenIcon className="size-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <TrashIcon className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Expanded source rows */}
      {isExpanded &&
        kb.sources.map((source) => (
          <TableRow key={source.id} className="hover:bg-muted/30 bg-muted/10">
            <TableCell className="px-6 py-3"></TableCell>
            <TableCell className="px-6 py-3 pl-14">
              <div className="flex items-center gap-3">
                <SourceIcon type={source.sourceType} />
                <div className="min-w-0">
                  <p className="truncate text-sm">{source.title}</p>
                  {source.sourceUrl && (
                    <p className="text-muted-foreground text-xs truncate">
                      {source.sourceUrl}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="px-6 py-3">
              <Badge variant="outline" className="capitalize text-xs">
                {source.sourceType}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-3">
              <StatusBadge status={source.indexingStatus} />
            </TableCell>
            <TableCell className="px-6 py-3 text-muted-foreground text-sm">
              {formatFileSize(source.fileSize)}
            </TableCell>
            <TableCell className="px-6 py-3">
              <Button
                className="size-8 p-0"
                size="sm"
                variant="ghost"
                onClick={() => onDeleteSource(source)}
              >
                <TrashIcon className="size-3.5 text-muted-foreground" />
              </Button>
            </TableCell>
          </TableRow>
        ))}

      {/* Empty state for expanded KB with no sources */}
      {isExpanded && kb.sources.length === 0 && (
        <TableRow className="bg-muted/10">
          <TableCell className="px-6 py-3"></TableCell>
          <TableCell className="px-6 py-3 pl-14 text-muted-foreground text-sm" colSpan={5}>
            No sources yet.{" "}
            {canAddSource ? (
              <button className="text-primary hover:underline" onClick={onAddSource}>
                Add one
              </button>
            ) : (
              <button className="text-primary hover:underline" onClick={onUpgrade}>
                Upgrade to add sources
              </button>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
