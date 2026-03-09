"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { CopyIcon, CheckIcon } from "lucide-react";

interface CodeBlockProps {
  code: string;
  title?: string;
}

export const CodeBlock = ({ code, title }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group mb-4">
      {title && (
        <div className="bg-muted border border-border border-b-0 rounded-t-lg px-4 py-2 text-sm font-medium text-foreground">
          {title}
        </div>
      )}
      <pre
        className={cn(
          "bg-muted border border-border p-4 overflow-x-auto",
          title ? "rounded-b-lg" : "rounded-lg",
        )}
      >
        <code className="text-sm font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        className="absolute top-2 right-2 size-8 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
        onClick={handleCopy}
      >
        {copied ? (
          <CheckIcon className="size-4 text-green-500" />
        ) : (
          <CopyIcon className="size-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
};
