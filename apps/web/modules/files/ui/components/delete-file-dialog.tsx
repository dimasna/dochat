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

interface FileData {
  id: string;
  title: string;
  sourceType?: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  status: string;
}

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileData | null;
  onDeleted?: () => void;
}

export const DeleteFileDialog = ({
  open,
  onOpenChange,
  file,
  onDeleted,
}: DeleteFileDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!file) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/knowledge/${file.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Knowledge Source</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this source? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        {file && (
          <div className="py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="font-medium">{file.title}</p>
              <p className="text-muted-foreground text-sm">
                Status: {file.status}
              </p>
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
            disabled={isDeleting || !file}
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
