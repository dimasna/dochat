import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import { CodeBlock } from "@/modules/docs/ui/components/code-block";

export const metadata = {
  title: "Self-Hosting Guide - Dochat Docs",
  description: "Deploy Dochat on your own infrastructure",
};

export default function SelfHostingPage() {
  return (
    <DocsContent>
      <h1>Self-Hosting Guide</h1>
      <p>Dochat can be self-hosted on your own infrastructure. This guide covers setup, configuration, and deployment.</p>
      <blockquote><strong>Note:</strong> Self-hosting requires experience with Node.js, PostgreSQL, and cloud infrastructure. For most users, the hosted version at <a href="https://dochat.site">dochat.site</a> is recommended.</blockquote>

      <h2>Prerequisites</h2>
      <ul>
        <li>Node.js 20+ and pnpm</li>
        <li>PostgreSQL 14+</li>
        <li>DigitalOcean account with GenAI API access</li>
        <li>Clerk account for authentication</li>
        <li>Domain with SSL</li>
      </ul>

      <h2>Clone &amp; Install</h2>
      <CodeBlock
        code={`git clone https://github.com/dimasna/dochat.git
cd dochat
pnpm install`}
      />

      <h2>Environment Variables</h2>
      <p>Create a <code>.env</code> file at the project root:</p>
      <CodeBlock
        title=".env"
        code={`# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dochat"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# DigitalOcean GenAI
DIGITALOCEAN_API_TOKEN="your_do_api_token"
DO_AGENT_MODEL_UUID="uuid_of_ai_model"

# App URLs
NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
NEXT_PUBLIC_WIDGET_URL="https://widget.yourdomain.com"

# File Storage (DigitalOcean Spaces / S3)
AWS_ACCESS_KEY_ID="your_access_key"
AWS_SECRET_ACCESS_KEY="your_secret_key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="dochat-uploads"`}
      />

      <h2>Database Setup</h2>
      <CodeBlock
        title="Create database"
        code={`createdb dochat`}
      />
      <CodeBlock
        title="Run migrations"
        code={`cd packages/db
pnpm prisma migrate deploy
pnpm prisma generate`}
      />

      <h2>Build</h2>
      <CodeBlock
        code={`# Build all packages and apps
pnpm build`}
      />
      <p>This builds the shared packages (<code>packages/db</code>, <code>packages/ui</code>) and both apps (<code>apps/web</code>, <code>apps/widget</code>).</p>

      <h2>Run</h2>
      <CodeBlock
        code={`# Start the web app (default port 3005)
pnpm --filter @dochat/web start

# Start the widget app (default port 3006)
pnpm --filter widget start`}
      />

      <h2>Docker Deployment</h2>
      <CodeBlock
        title="Dockerfile"
        code={`FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm build --filter=@dochat/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3005
CMD ["pnpm", "--filter", "@dochat/web", "start"]`}
      />
      <CodeBlock
        code={`docker build -t dochat-web .
docker run -p 3005:3005 --env-file .env dochat-web`}
      />

      <h2>DigitalOcean App Platform</h2>
      <ol>
        <li>Create a new App in DigitalOcean App Platform</li>
        <li>Connect your GitHub repository</li>
        <li>Set build command: <code>pnpm build</code></li>
        <li>Set run command: <code>pnpm --filter @dochat/web start</code></li>
        <li>Add all environment variables</li>
        <li>Deploy</li>
      </ol>
      <p>App Platform provides automatic SSL, scaling, and deployment on push.</p>

      <h2>Widget Deployment</h2>
      <p>The widget app should be deployed separately at a different subdomain (e.g., <code>widget.yourdomain.com</code>). It's a standard Next.js app that can be deployed the same way as the web app.</p>
      <p>Make sure <code>NEXT_PUBLIC_WIDGET_URL</code> in the web app matches the widget's URL.</p>

      <h2>DigitalOcean GenAI Setup</h2>
      <p>Dochat uses DigitalOcean's GenAI platform for AI agents and knowledge base search:</p>
      <ol>
        <li>Enable GenAI in your DigitalOcean account</li>
        <li>Create a project and note the project ID</li>
        <li>Get your API token from the DigitalOcean dashboard</li>
        <li>Find the model UUID from the available models list</li>
      </ol>
      <blockquote>Agents and knowledge bases are provisioned automatically through the app when users create them from the dashboard.</blockquote>

      <h2>Updating</h2>
      <CodeBlock
        code={`git pull origin main
cd packages/db && pnpm prisma migrate deploy
cd ../.. && pnpm build
# Restart your services`}
      />

      <h2>Troubleshooting</h2>
      <h3>Database connection errors</h3>
      <ul>
        <li>Verify <code>DATABASE_URL</code> format and credentials</li>
        <li>Check firewall rules allow connections from the app</li>
        <li>Ensure SSL mode matches your database configuration</li>
      </ul>

      <h3>Agent provisioning failures</h3>
      <ul>
        <li>Verify <code>DIGITALOCEAN_API_TOKEN</code> is valid and has GenAI access</li>
        <li>Check API quotas and rate limits</li>
        <li>Knowledge bases must be fully indexed before attaching to agents</li>
      </ul>

      <h3>Widget not connecting</h3>
      <ul>
        <li>Verify <code>NEXT_PUBLIC_WIDGET_URL</code> matches the deployed widget URL</li>
        <li>Check CORS — the widget iframe must be able to reach the web app APIs</li>
        <li>Ensure both apps have valid SSL certificates</li>
      </ul>
    </DocsContent>
  );
}
