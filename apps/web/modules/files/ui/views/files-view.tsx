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
import { FileIcon, FileTextIcon, GlobeIcon, MoreHorizontalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { UploadDialog } from "../components/upload-dialog";
import { useState } from "react";
import { DeleteFileDialog } from "../components/delete-file-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: "file" | "website" | "text";
  fileName?: string | null;
  sourceUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  status: string;
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

export const FilesView = () => {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge-docs"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KnowledgeDoc | null>(null);

  const handleDeleteClick = (file: KnowledgeDoc) => {
    setSelectedFile(file);
    setDeleteDialogOpen(true);
  };

  const handleFileDeleted = () => {
    setSelectedFile(null);
    queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
  };

  return (
    <>
      <DeleteFileDialog
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        file={selectedFile}
        onDeleted={handleFileDeleted}
      />
      <UploadDialog
        onOpenChange={setUploadDialogOpen}
        open={uploadDialogOpen}
      />
      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Manage knowledge sources for your AI assistant
            </p>
          </div>

          <div className="mt-8 rounded-lg border bg-background">
            <div className="flex items-center justify-end border-b px-6 py-4">
              <Button onClick={() => setUploadDialogOpen(true)}>
                <PlusIcon />
                Add New
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-4 font-medium">Name</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Type</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Status</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Size</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={5}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : files.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={5}>
                      No knowledge sources found
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow className="hover:bg-muted/50" key={file.id}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <SourceIcon type={file.sourceType} />
                          <div className="min-w-0">
                            <p className="truncate">{file.title}</p>
                            {file.sourceUrl && (
                              <p className="text-muted-foreground text-xs truncate">
                                {file.sourceUrl}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant="outline" className="capitalize">
                          {file.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className="uppercase" variant="outline">
                          {file.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="size-8 p-0"
                              size="sm"
                              variant="ghost"
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteClick(file)}
                            >
                              <TrashIcon className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};
