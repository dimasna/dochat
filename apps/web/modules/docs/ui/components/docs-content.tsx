import { ReactNode } from "react";

export const DocsContent = ({ children }: { children: ReactNode }) => {
  return <article className="prose-docs max-w-none">{children}</article>;
};
