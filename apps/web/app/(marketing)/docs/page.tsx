import { redirect } from "next/navigation";

export const metadata = {
  title: "Documentation - Dochat",
  description: "Learn how to build and deploy AI-powered chatbots with Dochat",
};

export default function DocsPage() {
  redirect("/docs/getting-started");
}
