import { DocsContent } from "@/modules/docs/ui/components/docs-content";

export const metadata = {
  title: "Managing Conversations - Dochat Docs",
  description: "Monitor and manage customer conversations in the Dochat dashboard",
};

export default function ConversationsPage() {
  return (
    <DocsContent>
      <h1>Managing Conversations</h1>
      <p>The Conversations panel gives you visibility into all customer interactions. Monitor AI responses, escalate to human operators, and resolve conversations from the dashboard.</p>

      <h2>Conversation Statuses</h2>
      <table>
        <thead>
          <tr><th>Status</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Unresolved</strong></td><td>Active conversation — AI is responding to the customer</td></tr>
          <tr><td><strong>Escalated</strong></td><td>Flagged for human attention — requires operator response</td></tr>
          <tr><td><strong>Resolved</strong></td><td>Issue addressed — conversation is closed</td></tr>
        </tbody>
      </table>

      <h2>Conversation List</h2>
      <p>The left panel shows all conversations grouped by customer:</p>
      <ul>
        <li>Customer name and avatar</li>
        <li>Last message preview</li>
        <li>Time since last activity</li>
        <li>Status indicator</li>
        <li>Conversation count per customer</li>
      </ul>
      <p>Use the filter dropdown to show only unresolved, escalated, or resolved conversations.</p>

      <h2>Conversation Details</h2>
      <p>Click a conversation to view the full message history. The detail view shows:</p>
      <ul>
        <li>Complete message thread (customer, AI, and operator messages)</li>
        <li>Customer metadata (browser, timezone, referrer)</li>
        <li>Conversation status with controls to escalate or resolve</li>
      </ul>

      <h2>Operator Messages</h2>
      <p>When a conversation is escalated, operators can reply directly from the dashboard:</p>
      <ol>
        <li>Open the escalated conversation</li>
        <li>Type your message in the input field</li>
        <li>Click Send — the customer sees it in real time</li>
      </ol>
      <p>Operator messages are labeled as "Support Agent" in the widget so the customer knows they're speaking with a human.</p>

      <h2>Escalation</h2>
      <h3>Automatic Escalation</h3>
      <p>The AI agent automatically escalates when:</p>
      <ul>
        <li>Customer explicitly requests human support</li>
        <li>Question is outside the knowledge base scope</li>
        <li>Customer appears frustrated or the AI can't resolve the issue</li>
      </ul>

      <h3>Manual Escalation</h3>
      <p>Operators can escalate any conversation from the conversation detail view using the status controls.</p>

      <h2>Resolving Conversations</h2>
      <h3>Auto-Resolution</h3>
      <p>The AI resolves conversations when the customer confirms their issue is addressed (e.g., "Thanks, that helps!").</p>

      <h3>Manual Resolution</h3>
      <p>Operators can manually resolve any conversation. Resolved conversations are closed — the customer can start a new one from the widget menu.</p>

      <h2>Real-Time Updates</h2>
      <p>The dashboard updates in real time using Server-Sent Events (SSE):</p>
      <ul>
        <li>New messages appear instantly without refreshing</li>
        <li>Status changes are reflected immediately</li>
        <li>Multiple operators can monitor conversations simultaneously</li>
      </ul>

      <h2>Best Practices</h2>
      <ul>
        <li>Respond to escalations within a few minutes</li>
        <li>Review unresolved conversations regularly</li>
        <li>Only mark conversations as resolved when the issue is truly complete</li>
        <li>Use conversation patterns to improve your agent's instructions and knowledge base</li>
        <li>Monitor conversation volume to identify common questions and update your knowledge base</li>
      </ul>
    </DocsContent>
  );
}
