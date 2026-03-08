export const INTEGRATIONS = [
  {
    id: "html",
    title: "HTML",
    icon: "/languages/html5.svg",
  },
  {
    id: "react",
    title: "React",
    icon: "/languages/react.svg",
  },
  {
    id: "nextjs",
    title: "Next.js",
    icon: "/languages/nextjs.svg",
  },
  {
    id: "javascript",
    title: "JavaScript",
    icon: "/languages/javascript.svg",
  },
];

export type IntegrationId = (typeof INTEGRATIONS)[number]["id"];

export const WIDGET_BASE_URL = process.env.NEXT_PUBLIC_WIDGET_URL || "https://your-dochat-widget.ondigitalocean.app";

export const HTML_SCRIPT = `<!-- Add before </body> -->
<script
  src="${WIDGET_BASE_URL}/widget.js"
  data-organization-id="{{ORGANIZATION_ID}}"
  data-agent-id="{{AGENT_ID}}"
></script>`;

export const REACT_SCRIPT = `// Add to your App.tsx or index.tsx
import { useEffect } from "react";

function App() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "${WIDGET_BASE_URL}/widget.js";
    script.setAttribute("data-organization-id", "{{ORGANIZATION_ID}}");
    script.setAttribute("data-agent-id", "{{AGENT_ID}}");
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, []);

  return <>{/* your app */}</>;
}`;

export const NEXTJS_SCRIPT = `// Add to your layout.tsx or page.tsx
import Script from "next/script";

export default function Layout({ children }) {
  return (
    <>
      {children}
      <Script
        src="${WIDGET_BASE_URL}/widget.js"
        data-organization-id="{{ORGANIZATION_ID}}"
        data-agent-id="{{AGENT_ID}}"
        strategy="lazyOnload"
      />
    </>
  );
}`;

export const JAVASCRIPT_SCRIPT = `// Add to your JavaScript file
const script = document.createElement("script");
script.src = "${WIDGET_BASE_URL}/widget.js";
script.setAttribute("data-organization-id", "{{ORGANIZATION_ID}}");
script.setAttribute("data-agent-id", "{{AGENT_ID}}");
document.body.appendChild(script);`;
