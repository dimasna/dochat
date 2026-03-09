import { AuthGuard } from "@/modules/auth/ui/components/auth-guard"
import { OrganizationGuard } from "@/modules/auth/ui/components/organization-guard"
import { AgentGuard } from "@/modules/auth/ui/components/agent-guard"
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { TopBar } from "@/modules/dashboard/ui/components/top-bar";
import { SidebarProvider } from "@workspace/ui/components/sidebar";
import { Provider } from "jotai";
import { cookies } from "next/headers";

export const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AuthGuard>
      <OrganizationGuard>
        <Provider>
          <AgentGuard>
            <div className="flex h-screen flex-col">
              <TopBar />
              <div className="flex flex-1 min-h-0 overflow-hidden [&_[data-slot=sidebar-container]]:top-14 [&_[data-slot=sidebar-container]]:h-[calc(100svh-3.5rem)] [&_[data-slot=sidebar-wrapper]]:min-h-0">
                <SidebarProvider defaultOpen={defaultOpen}>
                  <DashboardSidebar />
                  <main className="flex flex-1 flex-col min-h-0 overflow-auto">
                    {children}
                  </main>
                </SidebarProvider>
              </div>
            </div>
          </AgentGuard>
        </Provider>
      </OrganizationGuard>
    </AuthGuard>
  );
};
