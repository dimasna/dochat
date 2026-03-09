import Link from "next/link";
import Image from "next/image";
import { BotIcon, UsersIcon, ZapIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export const metadata = {
  title: "About - Dochat",
  description: "Learn about Dochat and our mission to transform customer support with AI",
};

const values = [
  {
    icon: BotIcon,
    title: "AI-First",
    description: "We believe AI should handle the repetitive so humans can focus on what matters.",
  },
  {
    icon: UsersIcon,
    title: "Customer-Centric",
    description: "Every feature is built to help your customers get answers faster.",
  },
  {
    icon: ZapIcon,
    title: "Simple by Default",
    description: "Deploy in minutes, not weeks. One script tag and you're live.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Privacy-First",
    description: "Your data stays yours. We don't train on your conversations or knowledge bases.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-20">
      <div className="mb-16">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <Image src="/logo.svg" alt="Dochat" width={32} height={32} />
          <span className="text-xl font-bold text-foreground">Dochat</span>
        </Link>
        <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">
          AI-powered customer support that actually works
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Dochat helps businesses automate customer support with AI agents trained on
          their own data. Upload your docs, deploy a chat widget, and let AI handle
          the questions your team answers every day.
        </p>
      </div>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-foreground mb-3">Our Mission</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Customer support shouldn't be a bottleneck. Most support questions are
          repetitive — password resets, shipping policies, product specs. Your team
          spends hours answering the same things while customers wait in queues.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We built Dochat to fix that. Train an AI agent on your knowledge base and
          deploy it in minutes. It answers instantly, 24/7, in any language — and
          escalates to your team when it needs help.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-foreground mb-6">What We Believe</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {values.map((v) => (
            <div key={v.title} className="border border-border rounded-lg p-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                <v.icon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-foreground mb-3">How It Works</h2>
        <ol className="space-y-3 text-muted-foreground leading-relaxed list-decimal list-inside">
          <li><strong className="text-foreground">Create an agent</strong> — give it a name, personality, and instructions.</li>
          <li><strong className="text-foreground">Add knowledge</strong> — upload documents, crawl your website, or paste text.</li>
          <li><strong className="text-foreground">Customize the widget</strong> — set your brand colors, logo, and greeting.</li>
          <li><strong className="text-foreground">Deploy</strong> — add one script tag to your site. Done.</li>
          <li><strong className="text-foreground">Monitor</strong> — track conversations, jump in when needed, improve over time.</li>
        </ol>
      </section>

      <section className="border border-border rounded-lg p-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Ready to get started?
        </h2>
        <p className="text-muted-foreground mb-6">
          Create your free account and deploy your first AI agent in minutes.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/docs">Read the Docs</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
