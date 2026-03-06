import {
  HTML_SCRIPT,
  type IntegrationId,
  JAVASCRIPT_SCRIPT,
  NEXTJS_SCRIPT,
  REACT_SCRIPT,
} from "./constants";

export const createScript = (
  integrationId: IntegrationId,
  organizationId: string,
  agentId?: string,
) => {
  const scripts: Record<string, string> = {
    html: HTML_SCRIPT,
    react: REACT_SCRIPT,
    nextjs: NEXTJS_SCRIPT,
    javascript: JAVASCRIPT_SCRIPT,
  };

  const template = scripts[integrationId] || "";
  return template
    .replace(/{{ORGANIZATION_ID}}/g, organizationId)
    .replace(/{{AGENT_ID}}/g, agentId || "YOUR_AGENT_ID");
};
