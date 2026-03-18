"use client";

import { Loader2Icon, MicIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export interface AIVoiceButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isRecording?: boolean;
  isProcessing?: boolean;
}

export const AIVoiceButton = ({
  isRecording,
  isProcessing,
  className,
  disabled,
  ...props
}: AIVoiceButtonProps) => {
  return (
    <button
      type="button"
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl transition-colors",
        "size-8",
        isRecording
          ? "bg-red-500 text-white"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      disabled={disabled || isProcessing}
      {...props}
    >
      {isProcessing ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <>
          <MicIcon className="size-4" />
          {isRecording && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </>
      )}
    </button>
  );
};
