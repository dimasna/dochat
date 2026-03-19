"use client";

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

  return <>{children}</>;
};
