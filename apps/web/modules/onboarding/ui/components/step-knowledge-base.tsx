"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  PlusIcon,
} from "lucide-react";
import { UploadDialog } from "@/modules/files/ui/components/upload-dialog";

interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: "file" | "website" | "text";
  status: string;
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

  const { data: docs = [] } = useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge-docs"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleFileUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
  };

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
            {docs.length} source{docs.length !== 1 ? "s" : ""} added
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <PlusIcon className="size-4 mr-1" />
            Add Source
          </Button>
        </div>

        {docs.length > 0 && (
          <div className="divide-y">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <SourceIcon type={doc.sourceType} />
                <span className="flex-1 text-sm truncate">{doc.title}</span>
                <Badge variant="outline" className="capitalize text-xs">
                  {doc.sourceType}
                </Badge>
                <Badge variant="outline" className="uppercase text-xs">
                  {doc.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && (
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
      />

      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={docs.length === 0}>
          Next
        </Button>
      </div>
    </div>
  );
};
