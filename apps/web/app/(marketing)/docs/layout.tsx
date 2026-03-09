import { DocsSidebar, MobileDocsSidebar } from "@/modules/docs/ui/components/docs-sidebar";
import { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DocsSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileDocsSidebar />
        <main className="flex-1 px-6 py-8 lg:px-12 lg:py-12 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}
