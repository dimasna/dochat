"use client";

import { CreateOrganization } from "@clerk/nextjs";

export const OrgSelectionView = () => {
  return <CreateOrganization afterCreateOrganizationUrl="/" />;
};
