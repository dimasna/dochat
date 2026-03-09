"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const Navbar = () => {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border transition-all duration-300 ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="max-w-[1160px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 group">
          <Image
            src="/logo.svg"
            alt="Dochat"
            width={26}
            height={26}
            className="transition-transform duration-300 group-hover:scale-110"
          />
          <span className="text-lg font-bold text-foreground tracking-tight">
            Dochat
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isSignedIn ? (
            <Button size="sm" asChild>
              <Link href="/workspace">Go to Workspace</Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="mt-8 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <hr className="border-border my-2" />
              {isSignedIn ? (
                <Button asChild>
                  <Link href="/workspace" onClick={() => setOpen(false)}>
                    Go to Workspace
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/sign-up" onClick={() => setOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
