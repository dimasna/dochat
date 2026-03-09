"use client";

import { LoaderIcon } from "lucide-react";

export const WidgetErrorScreen = () => {
  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
};
