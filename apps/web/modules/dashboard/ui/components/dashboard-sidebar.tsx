"use client";

import {
  BotIcon,
  CreditCardIcon,
  InboxIcon,
  LibraryBigIcon,
  PlayIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";

export const DashboardSidebar = () => {
  const pathname = usePathname();

  const isWorkspaceLevel =
    pathname === "/" ||
    pathname === "/workspace" ||
    pathname === "/files" ||
    pathname.startsWith("/files") ||
    pathname === "/billing";

  return (
    <Sidebar className="border-r pt-0">
      <SidebarContent>
        {isWorkspaceLevel ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuItem
                  href="/workspace"
                  icon={BotIcon}
                  label="Agents"
                  active={pathname === "/workspace" || pathname === "/"}
                />
                <MenuItem
                  href="/files"
                  icon={LibraryBigIcon}
                  label="Knowledge Base"
                  active={pathname.startsWith("/files")}
                />
                <MenuItem
                  href="/billing"
                  icon={CreditCardIcon}
                  label="Plans & Billing"
                  active={pathname.startsWith("/billing")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuItem
                  href="/conversations"
                  icon={InboxIcon}
                  label="Conversations"
                  active={pathname.startsWith("/conversations")}
                />
                <MenuItem
                  href="/playground"
                  icon={PlayIcon}
                  label="Playground"
                  active={pathname.startsWith("/playground")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

function MenuItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(active && "bg-sidebar-accent font-medium")}
      >
        <Link href={href}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

