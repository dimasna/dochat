import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import Link from "next/link";

export const metadata = {
  title: "Widget Customization - Dochat Docs",
  description: "Customize your Dochat chat widget appearance and behavior",
};

export default function WidgetCustomizationPage() {
  return (
    <DocsContent>
      <h1>Widget Customization</h1>
      <p>Customize your chat widget to match your brand. Each agent has its own widget settings that control appearance and behavior.</p>

      <h2>Accessing Settings</h2>
      <ol>
        <li>Select your agent from the workspace</li>
        <li>Navigate to <strong>Customization</strong> in the sidebar</li>
        <li>Make your changes and click <strong>Save</strong></li>
      </ol>

      <h2>Customization Options</h2>

      <h3>Greeting Message</h3>
      <p>The first message customers see when the chat opens. Set expectations and make it welcoming.</p>
      <ul>
        <li><strong>Default:</strong> "Hi! How can I help you today?"</li>
        <li>Keep it short — 1-2 sentences max</li>
        <li>Match the tone to your brand (formal, friendly, technical)</li>
      </ul>

      <h3>Suggested Questions</h3>
      <p>Show up to 3 clickable question buttons below the greeting to help customers get started:</p>
      <ul>
        <li>"What are your shipping options?"</li>
        <li>"How do I return an item?"</li>
        <li>"Tell me about your pricing"</li>
      </ul>
      <p>Choose questions that match your most common customer queries.</p>

      <h3>Theme Color</h3>
      <p>Set a hex color code (e.g., <code>#3b82f6</code>) to match your brand. This changes:</p>
      <ul>
        <li>Widget launch button</li>
        <li>Header background</li>
        <li>Customer message bubbles</li>
        <li>Send button and interactive elements</li>
      </ul>

      <h3>Widget Logo</h3>
      <p>Upload a custom logo for the widget header:</p>
      <ul>
        <li><strong>Format:</strong> PNG, JPG, or SVG</li>
        <li><strong>Recommended size:</strong> 40x40px to 80x80px</li>
        <li><strong>Transparent background</strong> recommended</li>
      </ul>
      <p>When no logo is uploaded, a default chat icon is shown.</p>

      <h2>Widget Behavior</h2>
      <h3>Position</h3>
      <p>The widget appears as a floating button. You can configure it to appear in the <strong>bottom-right</strong> or <strong>bottom-left</strong> corner via the embed snippet's <code>data-position</code> attribute.</p>

      <h3>Conversation Persistence</h3>
      <p>When a customer reloads the page, their last active conversation is automatically restored. They can start a new conversation from the widget menu.</p>

      <h3>Mobile</h3>
      <p>The widget automatically adapts for mobile screens with a touch-optimized, full-width interface.</p>

      <h2>Tips</h2>
      <ul>
        <li>Use brand colors to build trust and recognition</li>
        <li>Keep greetings short and friendly</li>
        <li>Choose suggestions based on your most common customer queries</li>
        <li>Test on both desktop and mobile</li>
        <li>Update suggestions based on real conversation data over time</li>
      </ul>

      <h2>Next Step</h2>
      <p>Once you've customized your widget, <Link href="/docs/widget-integration">add it to your website</Link>.</p>
    </DocsContent>
  );
}
