"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveAgent } from "@/hooks/use-active-agent";
import { AuthLayout } from "@/modules/auth/ui/layouts/auth-layout";

const EXEMPT_ROUTES = ["/onboarding", "/workspace", "/files", "/billing"];

export const AgentGuard = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoadingAgents, hasNoAgents, activeAgent } = useActiveAgent();

  const isExempt = EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    // Redirect to agents page if on a non-exempt route with no agents or no active agent
    if (!isLoadingAgents && !isExempt && (hasNoAgents || !activeAgent)) {
      router.replace("/workspace");
    }
  }, [isLoadingAgents, isExempt, hasNoAgents, activeAgent, router]);

  // Allow exempt routes through without an agent
  if (isExempt) {
    return <>{children}</>;
  }

  if (isLoadingAgents || !activeAgent) {
    return (
      <AuthLayout>
        <p>Loading...</p>
      </AuthLayout>
    );
  }

  return <>{children}</>;
};
