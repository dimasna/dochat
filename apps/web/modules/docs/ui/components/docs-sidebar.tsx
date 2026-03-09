"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { DOC_SECTIONS } from "../../constants";
import { BookOpenIcon, MenuIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Button } from "@workspace/ui/components/button";

export const DocsSidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-border bg-muted/30 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      <nav className="p-6 space-y-1">
        <div className="flex items-center gap-2 mb-4 px-2">
          <BookOpenIcon className="size-5 text-primary" />
          <h2 className="font-semibold text-lg">Docs</h2>
        </div>
        {DOC_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = pathname === section.href;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{section.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export const MobileDocsSidebar = () => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = DOC_SECTIONS.find((s) => s.href === pathname);

  return (
    <div className="lg:hidden sticky top-16 z-40 bg-background/95 backdrop-blur border-b border-border">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="m-2 gap-2">
            <MenuIcon className="size-4" />
            <span className="text-sm">{current?.title || "Documentation"}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetTitle className="sr-only">Documentation Navigation</SheetTitle>
          <nav className="mt-8 space-y-1">
            {DOC_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = pathname === section.href;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{section.title}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
};
