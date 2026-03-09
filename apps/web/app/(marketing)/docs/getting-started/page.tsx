import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import Link from "next/link";

export const metadata = {
  title: "Getting Started - Dochat Docs",
  description: "Learn the basics of setting up your first AI chatbot with Dochat",
};

export default function GettingStartedPage() {
  return (
    <DocsContent>
      <h1>Getting Started</h1>
      <p>Dochat is an AI-powered customer support platform that lets you build intelligent chatbots trained on your own data. Deploy in minutes with a single line of code.</p>

      <h2>Quick Start</h2>
      <ol>
        <li><strong>Sign up</strong> — Create your free account at <Link href="/sign-up">dochat.site/sign-up</Link>. No credit card required.</li>
        <li><strong>Create an agent</strong> — Go to Workspace and click "Create Agent". Give it a name, description, and custom instructions.</li>
        <li><strong>Add knowledge</strong> — Upload documents, crawl websites, or paste text to train your agent on your domain.</li>
        <li><strong>Customize</strong> — Set a greeting message, theme color, logo, and suggested questions.</li>
        <li><strong>Deploy</strong> — Copy the embed snippet and add it to your website. Your agent is live.</li>
      </ol>

      <h2>Key Concepts</h2>
      <h3>Agents</h3>
      <p>Agents are AI chatbots with their own personality, knowledge, and configuration. Each agent can be deployed as a separate widget on your site. <Link href="/docs/agents">Learn more about agents</Link>.</p>

      <h3>Knowledge Bases</h3>
      <p>Knowledge bases are collections of documents, websites, and text that your agent uses to answer questions. Content is chunked, embedded, and stored for semantic search. <Link href="/docs/knowledge-base">Learn more about knowledge bases</Link>.</p>

      <h3>Widget</h3>
      <p>The widget is an embeddable chat interface that connects your visitors to your AI agent. It's customizable and works on any website. <Link href="/docs/widget-integration">Learn more about the widget</Link>.</p>

      <h3>Conversations</h3>
      <p>Every customer interaction is tracked as a conversation. You can monitor, escalate to human operators, and resolve conversations from the dashboard. <Link href="/docs/conversations">Learn more about conversations</Link>.</p>

      <h2>System Requirements</h2>
      <p>Dochat works with any modern website:</p>
      <ul>
        <li>HTML, React, Next.js, Vue, WordPress, or vanilla JavaScript</li>
        <li>Modern browsers (Chrome, Firefox, Safari, Edge)</li>
        <li>No backend changes or server-side code required</li>
      </ul>

      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/agents">Create your first agent</Link></li>
        <li><Link href="/docs/knowledge-base">Build a knowledge base</Link></li>
        <li><Link href="/docs/widget-integration">Add the widget to your site</Link></li>
      </ul>
    </DocsContent>
  );
}
