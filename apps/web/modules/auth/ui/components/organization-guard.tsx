"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  OrganizationSwitcher,
  useOrganization,
} from "@clerk/nextjs";
import { AuthLayout } from "@/modules/auth/ui/layouts/auth-layout";

export const OrganizationGuard = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { organization, isLoaded } = useOrganization();
  const pathname = usePathname();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !organization) return;

    // Skip check if already on onboarding page
    if (pathname === "/onboarding") {
      setOnboardingChecked(true);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        if (res.ok) {
          const data = await res.json();
          if (!data.complete) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch {
        // If check fails, allow through
      }
      setOnboardingChecked(true);
    };

    checkOnboarding();
  }, [isLoaded, organization, pathname, router]);

  if (!isLoaded) {
    return (
      <AuthLayout>
        <p>Loading...</p>
      </AuthLayout>
    );
  }

  if (!organization) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Select an organization</h2>
          <OrganizationSwitcher hidePersonal />
        </div>
      </AuthLayout>
    );
  }

  if (!onboardingChecked && pathname !== "/onboarding") {
    return (
      <AuthLayout>
        <p>Loading...</p>
      </AuthLayout>
    );
  }

  return <>{children}</>;
};
