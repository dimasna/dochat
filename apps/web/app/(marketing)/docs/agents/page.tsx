import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import { CodeBlock } from "@/modules/docs/ui/components/code-block";
import Link from "next/link";

export const metadata = {
  title: "Creating Agents - Dochat Docs",
  description: "Learn how to create and configure AI agents in Dochat",
};

export default function AgentsPage() {
  return (
    <DocsContent>
      <h1>Creating Agents</h1>
      <p>Agents are the core of Dochat. Each agent is an AI chatbot with its own knowledge base, personality, and configuration. You can create multiple agents for different purposes.</p>

      <h2>Create a New Agent</h2>
      <ol>
        <li>Navigate to <strong>Workspace</strong> from the dashboard</li>
        <li>Click <strong>"Create Agent"</strong></li>
        <li>Fill in the agent details (name, description, instructions)</li>
        <li>Optionally attach knowledge bases</li>
        <li>Click <strong>"Create"</strong></li>
      </ol>
      <p>Provisioning takes about 30–60 seconds. You'll see a "Provisioning" status during this time.</p>

      <h2>Agent Settings</h2>
      <h3>Name</h3>
      <p>A clear name to identify this agent in the dashboard. This is also shown to customers in the widget header.</p>

      <h3>Description</h3>
      <p>A brief summary of what this agent handles. For example: "Customer support for e-commerce orders" or "Technical documentation assistant."</p>

      <h3>Custom Instructions</h3>
      <p>Instructions shape how your agent responds. You can define tone, response style, escalation rules, and domain-specific guidelines.</p>
      <CodeBlock
        title="Example: E-commerce Support Agent"
        code={`You are a helpful e-commerce support agent for TechStore.

When customers ask about:
- Orders: Check order status and provide tracking info
- Returns: Explain our 30-day return policy
- Products: Answer questions using the product catalog
- Technical issues: Escalate to human support

Always be friendly and professional. Keep responses concise.
If you cannot answer a question, escalate to a human agent.`}
      />

      <h3>Knowledge Base Attachment</h3>
      <p>You can link one or more knowledge bases when creating an agent. The agent searches these to answer customer questions.</p>
      <blockquote>
        <strong>Important:</strong> Knowledge bases must be fully indexed (status "Ready") before they can be attached to an agent.
      </blockquote>

      <h2>Managing Agents</h2>
      <h3>Update an Agent</h3>
      <p>Select the agent from the workspace, then edit its name, description, or instructions. Changes take effect immediately.</p>

      <h3>Delete an Agent</h3>
      <p>Deleting an agent removes it permanently along with its widget configuration. Conversations are preserved for reference.</p>

      <h2>Multiple Agents</h2>
      <p>Organizations can create multiple agents for different use cases:</p>
      <ul>
        <li><strong>Sales agent</strong> — trained on product catalog and pricing</li>
        <li><strong>Support agent</strong> — trained on troubleshooting docs and FAQs</li>
        <li><strong>Billing agent</strong> — trained on payment and subscription info</li>
      </ul>
      <p>Each agent has its own widget settings, so you can deploy different agents on different pages of your site.</p>

      <h2>Testing in Playground</h2>
      <p>Before deploying, test your agent in the <strong>Playground</strong> from the dashboard. Send test messages, verify knowledge retrieval, and refine instructions until you're satisfied.</p>

      <h2>Best Practices</h2>
      <ul>
        <li>Start with clear, specific instructions (under 500 words)</li>
        <li>Include escalation rules for questions outside the agent's scope</li>
        <li>Test in the Playground before deploying to production</li>
        <li>Use descriptive names when managing multiple agents</li>
        <li>Keep instructions focused — one agent per domain works best</li>
      </ul>
    </DocsContent>
  );
}
