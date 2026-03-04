"use client";

import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/nextjs";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};
