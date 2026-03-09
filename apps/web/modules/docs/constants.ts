import {
  BookOpenIcon,
  BotIcon,
  DatabaseIcon,
  PaletteIcon,
  CodeIcon,
  MessageSquareIcon,
  ServerIcon,
} from "lucide-react";

export const DOC_SECTIONS = [
  {
    title: "Getting Started",
    href: "/docs/getting-started",
    icon: BookOpenIcon,
  },
  {
    title: "Creating Agents",
    href: "/docs/agents",
    icon: BotIcon,
  },
  {
    title: "Knowledge Base",
    href: "/docs/knowledge-base",
    icon: DatabaseIcon,
  },
  {
    title: "Widget Customization",
    href: "/docs/widget-customization",
    icon: PaletteIcon,
  },
  {
    title: "Widget Integration",
    href: "/docs/widget-integration",
    icon: CodeIcon,
  },
  {
    title: "Conversations",
    href: "/docs/conversations",
    icon: MessageSquareIcon,
  },
  {
    title: "Self-Hosting",
    href: "/docs/self-hosting",
    icon: ServerIcon,
  },
] as const;
