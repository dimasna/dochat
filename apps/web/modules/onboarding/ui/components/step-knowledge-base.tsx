"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  FileIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  PlusIcon,
} from "lucide-react";
import { UploadDialog } from "@/modules/files/ui/components/upload-dialog";

interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: "file" | "website" | "text";
  indexingStatus: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  indexingStatus: string;
  sources: KnowledgeSource[];
  _count: { sources: number };
}

interface StepKnowledgeBaseProps {
  onComplete: () => void;
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

export const StepKnowledgeBase = ({ onComplete }: StepKnowledgeBaseProps) => {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [defaultKbId, setDefaultKbId] = useState<string | null>(null);

  const { data: kbs = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["knowledge-bases"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Auto-create a default KB for onboarding if none exist
  useEffect(() => {
    if (kbs.length === 0 && !defaultKbId) {
      fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Getting Started" }),
      })
        .then((res) => res.json())
        .then((kb) => {
          setDefaultKbId(kb.id);
          queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
        })
        .catch(console.error);
    } else if (kbs.length > 0 && !defaultKbId) {
      setDefaultKbId(kbs[0]!.id);
    }
  }, [kbs, defaultKbId, queryClient]);

  const handleFileUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
  };

  const totalSources = kbs.reduce((sum, kb) => sum + kb._count.sources, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add Knowledge Sources</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload documents, add websites, or paste text that your AI agent will
          use to answer customer questions.
        </p>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {totalSources} source{totalSources !== 1 ? "s" : ""} added
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)} disabled={!defaultKbId}>
            <PlusIcon className="size-4 mr-1" />
            Add Source
          </Button>
        </div>

        {kbs.length > 0 && kbs.some((kb) => kb.sources.length > 0) && (
          <div className="divide-y">
            {kbs.flatMap((kb) =>
              kb.sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <SourceIcon type={source.sourceType} />
                  <span className="flex-1 text-sm truncate">{source.title}</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {source.sourceType}
                  </Badge>
                  <Badge variant="outline" className="uppercase text-xs">
                    {source.indexingStatus}
                  </Badge>
                </div>
              )),
            )}
          </div>
        )}

        {totalSources === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileTextIcon className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No knowledge sources yet. Add at least one to continue.
            </p>
          </div>
        )}
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFileUploaded={handleFileUploaded}
        knowledgeBaseId={defaultKbId}
      />

      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={totalSources === 0}>
          Next
        </Button>
      </div>
    </div>
  );
};
