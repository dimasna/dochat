"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@workspace/ui/components/dropzone";
import { FileIcon, GlobeIcon, FileTextIcon } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUploaded?: () => void;
}

type SourceType = "file" | "website" | "text";

export const UploadDialog = ({
  open,
  onOpenChange,
  onFileUploaded,
}: UploadDialogProps) => {
  const queryClient = useQueryClient();

  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File tab state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filename, setFilename] = useState("");

  // Website tab state
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteTitle, setWebsiteTitle] = useState("");
  const [crawlingOption, setCrawlingOption] = useState("SCOPED");

  // Text tab state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  const handleFileDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFiles([file]);
      if (!filename) setFilename(file.name);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("sourceType", sourceType);

      if (sourceType === "file") {
        const blob = uploadedFiles[0];
        if (!blob) return;
        formData.append("file", blob, filename || blob.name);
      } else if (sourceType === "website") {
        formData.append("url", websiteUrl);
        formData.append("title", websiteTitle || websiteUrl);
        formData.append("crawlingOption", crawlingOption);
      } else if (sourceType === "text") {
        formData.append("title", textTitle);
        formData.append("content", textContent);
      }

      const res = await fetch("/api/knowledge", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add source");
      }

      queryClient.invalidateQueries({ queryKey: ["knowledge-docs"] });
      onFileUploaded?.();
      handleCancel();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setUploadedFiles([]);
    setFilename("");
    setWebsiteUrl("");
    setWebsiteTitle("");
    setCrawlingOption("SCOPED");
    setTextTitle("");
    setTextContent("");
  };

  const isDisabled =
    isSubmitting ||
    (sourceType === "file" && uploadedFiles.length === 0) ||
    (sourceType === "website" && !websiteUrl) ||
    (sourceType === "text" && (!textTitle || !textContent));

  const submitLabel = isSubmitting
    ? "Adding..."
    : sourceType === "file"
      ? "Upload"
      : sourceType === "website"
        ? "Add Website"
        : "Save Text";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Source</DialogTitle>
          <DialogDescription>
            Add content to your knowledge base for AI-powered search and
            retrieval
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={sourceType}
          onValueChange={(v) => setSourceType(v as SourceType)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1 gap-1.5">
              <FileIcon className="size-3.5" />
              File
            </TabsTrigger>
            <TabsTrigger value="website" className="flex-1 gap-1.5">
              <GlobeIcon className="size-3.5" />
              Website
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 gap-1.5">
              <FileTextIcon className="size-3.5" />
              Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="filename">
                Filename{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="filename"
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Override default filename"
                value={filename}
              />
            </div>

            <Dropzone
              accept={{
                "application/pdf": [".pdf"],
                "text/csv": [".csv"],
                "text/plain": [".txt"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                  [".docx"],
                "text/markdown": [".md"],
                "application/json": [".json"],
              }}
              disabled={isSubmitting}
              maxFiles={1}
              onDrop={handleFileDrop}
              src={uploadedFiles}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
          </TabsContent>

          <TabsContent value="website" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="website-url">URL</Label>
              <Input
                id="website-url"
                placeholder="https://docs.example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-title">
                Title{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="website-title"
                placeholder="My Documentation"
                value={websiteTitle}
                onChange={(e) => setWebsiteTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Crawling Scope</Label>
              <Select value={crawlingOption} onValueChange={setCrawlingOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCOPED">This page only</SelectItem>
                  <SelectItem value="PATH">Same path pages</SelectItem>
                  <SelectItem value="DOMAIN">Entire domain</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                &ldquo;Same path pages&rdquo; follows links within the URL path.
                &ldquo;Entire domain&rdquo; crawls up to 5,500 pages.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="text-title">Title</Label>
              <Input
                id="text-title"
                placeholder="e.g., Company FAQ"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">Content</Label>
              <Textarea
                id="text-content"
                placeholder="Paste your text content here..."
                className="min-h-[200px]"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={handleCancel}
            variant="outline"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
