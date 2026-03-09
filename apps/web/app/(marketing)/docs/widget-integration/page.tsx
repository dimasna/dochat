import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import { CodeBlock } from "@/modules/docs/ui/components/code-block";

export const metadata = {
  title: "Widget Integration - Dochat Docs",
  description: "Add the Dochat chat widget to your website",
};

export default function WidgetIntegrationPage() {
  return (
    <DocsContent>
      <h1>Widget Integration</h1>
      <p>Add the Dochat widget to your website with a single script tag. We provide integration code for HTML, React, Next.js, and vanilla JavaScript.</p>

      <h2>Getting Your Code</h2>
      <ol>
        <li>Select your agent from the workspace</li>
        <li>Go to <strong>Setup &amp; Integrations</strong></li>
        <li>Choose your platform</li>
        <li>Copy the code snippet</li>
      </ol>

      <h2>HTML</h2>
      <p>Add this script before the closing <code>&lt;/body&gt;</code> tag:</p>
      <CodeBlock
        title="index.html"
        code={`<script
  src="https://widget.dochat.site/widget.js"
  data-organization-id="YOUR_ORG_ID"
  data-agent-id="YOUR_AGENT_ID"
  async
></script>`}
      />

      <h2>React</h2>
      <p>Load the widget in your root component:</p>
      <CodeBlock
        title="App.tsx"
        code={`import { useEffect } from "react";

function App() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://widget.dochat.site/widget.js";
    script.setAttribute("data-organization-id", "YOUR_ORG_ID");
    script.setAttribute("data-agent-id", "YOUR_AGENT_ID");
    script.async = true;
    document.body.appendChild(script);

    return () => { script.remove(); };
  }, []);

  return <div>{/* Your app */}</div>;
}`}
      />

      <h2>Next.js (App Router)</h2>
      <CodeBlock
        title="app/layout.tsx"
        code={`import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://widget.dochat.site/widget.js"
          data-organization-id="YOUR_ORG_ID"
          data-agent-id="YOUR_AGENT_ID"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}`}
      />

      <h2>Next.js (Pages Router)</h2>
      <CodeBlock
        title="pages/_app.tsx"
        code={`import Script from "next/script";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Script
        src="https://widget.dochat.site/widget.js"
        data-organization-id="YOUR_ORG_ID"
        data-agent-id="YOUR_AGENT_ID"
        strategy="lazyOnload"
      />
    </>
  );
}`}
      />

      <h2>Vanilla JavaScript</h2>
      <CodeBlock
        code={`const script = document.createElement("script");
script.src = "https://widget.dochat.site/widget.js";
script.setAttribute("data-organization-id", "YOUR_ORG_ID");
script.setAttribute("data-agent-id", "YOUR_AGENT_ID");
script.async = true;
document.body.appendChild(script);`}
      />

      <h2>Configuration Attributes</h2>
      <h3>Required</h3>
      <table>
        <thead>
          <tr><th>Attribute</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>data-organization-id</code></td><td>Your organization ID</td></tr>
          <tr><td><code>data-agent-id</code></td><td>Your agent ID</td></tr>
        </tbody>
      </table>

      <h3>Optional</h3>
      <table>
        <thead>
          <tr><th>Attribute</th><th>Description</th><th>Default</th></tr>
        </thead>
        <tbody>
          <tr><td><code>data-position</code></td><td>Widget button position</td><td><code>bottom-right</code></td></tr>
        </tbody>
      </table>

      <h2>Verification</h2>
      <ol>
        <li>Refresh your website after adding the code</li>
        <li>Look for the chat button in the bottom corner</li>
        <li>Click to open and send a test message</li>
        <li>Check that the conversation appears in your dashboard</li>
      </ol>

      <h2>Troubleshooting</h2>
      <h3>Widget not appearing</h3>
      <ul>
        <li>Verify the script is inside <code>&lt;body&gt;</code>, not <code>&lt;head&gt;</code></li>
        <li>Check that organization ID and agent ID are correct</li>
        <li>Look for errors in the browser console</li>
        <li>Ensure ad blockers aren't interfering</li>
      </ul>

      <h3>Widget not responding</h3>
      <ul>
        <li>Confirm your agent status is "Active" (not "Provisioning")</li>
        <li>Ensure the agent has an indexed knowledge base attached</li>
        <li>Check network requests in browser DevTools</li>
      </ul>

      <h2>Performance</h2>
      <p>The widget is optimized for minimal impact on your site:</p>
      <ul>
        <li>Lazy loaded — doesn't block initial page render</li>
        <li>Loads in an isolated iframe — no CSS conflicts</li>
        <li>Cached for fast subsequent page loads</li>
      </ul>
    </DocsContent>
  );
}
