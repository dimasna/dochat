import Link from "next/link";
import Image from "next/image";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Support", href: "mailto:support@dochat.site" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

export const Footer = () => (
  <footer className="border-t border-border bg-muted/30">
    <div className="max-w-[1160px] mx-auto px-6 pt-16 pb-10">
      <div className="grid md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 mb-12">
        <div>
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Image src="/logo.svg" alt="Dochat" width={24} height={24} />
            <span className="font-bold text-foreground text-lg">Dochat</span>
          </Link>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">
            AI-powered customer support that learns from your data and gets
            smarter over time.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div className="text-sm font-semibold text-foreground mb-4">
              {col.title}
            </div>
            {col.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block text-sm text-muted-foreground mb-2.5 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-6 flex justify-between items-center flex-wrap gap-4">
        <span className="text-muted-foreground/60 text-xs">
          &copy; {new Date().getFullYear()} Dochat
        </span>
        <div className="flex gap-5">
          <Link
            href="#"
            className="text-muted-foreground/60 text-xs hover:text-muted-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="#"
            className="text-muted-foreground/60 text-xs hover:text-muted-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  </footer>
);
