"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

interface KbData {
  id: string;
  name: string;
  indexingStatus: string;
  _count: { sources: number };
}

interface SourceData {
  id: string;
  title: string;
  sourceType?: string;
  indexingStatus: string;
}

type DeleteFileDialogProps =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      mode: "kb";
      kb: KbData | null;
      source?: never;
      kbId?: never;
      onDeleted?: () => void;
    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      mode: "source";
      source: SourceData | null;
      kbId?: string;
      kb?: never;
      onDeleted?: () => void;
    };

export const DeleteFileDialog = (props: DeleteFileDialogProps) => {
  const { open, onOpenChange, mode, onDeleted } = props;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      let url: string;
      if (mode === "kb" && props.kb) {
        url = `/api/knowledge-bases/${props.kb.id}`;
      } else if (mode === "source" && props.source && props.kbId) {
        url = `/api/knowledge-bases/${props.kbId}/sources/${props.source.id}`;
      } else {
        return;
      }

      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const title = mode === "kb" ? "Delete Knowledge Base" : "Delete Source";
  const description =
    mode === "kb"
      ? "Are you sure you want to delete this knowledge base and all its sources? This action cannot be undone."
      : "Are you sure you want to remove this source from the knowledge base? This action cannot be undone.";

  const itemName = mode === "kb" ? props.kb?.name : props.source?.title;
  const itemStatus = mode === "kb" ? props.kb?.indexingStatus : props.source?.indexingStatus;
  const hasItem = mode === "kb" ? !!props.kb : !!props.source;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {hasItem && (
          <div className="py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="font-medium">{itemName}</p>
              <p className="text-muted-foreground text-sm">
                Status: {itemStatus}
              </p>
              {mode === "kb" && props.kb && (
                <p className="text-muted-foreground text-sm">
                  {props.kb._count.sources} source{props.kb._count.sources !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isDeleting || !hasItem}
            onClick={handleDelete}
            variant="destructive"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
