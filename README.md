Dochat - AI Customer Support Agent SAAS

## Tech Stack

- **Framework:** Next.js 15 (Turbopack)
- **Monorepo:** pnpm workspaces + Turborepo
- **Database:** PostgreSQL + Prisma
- **Auth:** Clerk
- **Payments:** DodoPayments
- **AI:** DigitalOcean GenAI Platform
- **Storage:** DigitalOcean Spaces (S3-compatible)
- **Real-time:** Server-Sent Events (SSE) + in-memory event bus

## Project Structure

```
apps/
  web/       → Main dashboard app (Next.js)
  widget/    → Embeddable chat widget (Next.js)
packages/
  db/        → Prisma schema & client
  ui/        → Shared UI components
  shared/    → Shared utilities
```

### Key Modules

```
apps/web/lib/
  digitalocean/          → DO GenAI API integration layer
    types.ts             → Shared API request/response types
    errors.ts            → DoApiError class
    client.ts            → Typed HTTP client (doFetch, doFetchRaw)
    agents.api.ts        → Agent CRUD, access keys, visibility
    knowledge-bases.api.ts → KB CRUD, datasource management
    workspaces.api.ts    → Workspace CRUD
    indexing.api.ts      → KB indexing triggers & status polling
  agent.ts               → Agent provisioning, sync, chat orchestration
  knowledge-base.ts      → KB provisioning, indexing, datasource building
  auth.ts                → Clerk auth helpers, subscription bootstrapping
  event-bus.ts           → In-memory pub/sub for real-time SSE events
  limits.ts              → Plan-based usage limits & credit checks
```

### Architecture

The DigitalOcean GenAI integration follows a layered architecture:

1. **Types & Errors** (`types.ts`, `errors.ts`) — Shared type definitions and error classes
2. **HTTP Client** (`client.ts`) — Authenticated fetch wrapper with error handling
3. **API Modules** (`*.api.ts`) — Low-level DO API calls, one module per resource
4. **Service Layer** (`agent.ts`, `knowledge-base.ts`) — Business logic that orchestrates API calls with database operations

## Local Development

```bash
pnpm install
cp .env.example .env   # fill in your values
pnpm db:generate
pnpm db:push
pnpm dev
```

Web app: `http://localhost:3005` | Widget: `http://localhost:3006`

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# DigitalOcean GenAI
DIGITALOCEAN_API_TOKEN=
DO_PROJECT_ID=
DO_AGENT_REGION=
DO_AGENT_MODEL_UUID=
DO_EMBEDDING_MODEL_UUID=

# Widget
NEXT_PUBLIC_WIDGET_URL=http://localhost:3006

# Landing page widget (optional — shows demo widget on marketing page)
NEXT_PUBLIC_LANDING_WIDGET_ORG_ID=
NEXT_PUBLIC_LANDING_WIDGET_AGENT_ID=

# DigitalOcean Spaces (S3-compatible storage for KB file uploads)
SPACES_ACCESS_KEY_ID=
SPACES_SECRET_ACCESS_KEY=
SPACES_BUCKET=
SPACES_REGION=

# DodoPayments
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_ENVIRONMENT=
DODO_PAYMENTS_WEBHOOK_SECRET=
DODO_STARTER_PRODUCT_ID=
DODO_GROWTH_PRODUCT_ID=
DODO_SCALE_PRODUCT_ID=
```

## Deployment (DigitalOcean App Platform)

### Prerequisites

1. [DigitalOcean](https://www.digitalocean.com/) account with [GitHub connected](https://cloud.digitalocean.com/apps) (authorize repo access)
2. [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) CLI installed and authenticated:
   ```bash
   brew install doctl
   doctl auth init
   ```
3. A PostgreSQL database (managed or external) with `DATABASE_URL` in your `.env`

### Deploy

```bash
bash .do/deploy.sh
```

That's it. The script reads your `.env`, injects secrets into the app spec, and creates/updates the app via `doctl`. No secrets are committed to git.

### How It Works

- `.do/app.yaml` defines a two-service app spec (web + widget) with `__PLACEHOLDER__` values for secrets
- `.do/deploy.sh` replaces placeholders with real values from `.env` at deploy time
- The generated spec is temporary and deleted after deployment
- `deploy_on_push: true` auto-deploys on every push to `main`
- Ingress routes `/widget/*` to the widget service, everything else to the web service
- DO App Platform strips the `/widget` prefix before forwarding — the widget uses `assetPrefix` (not `basePath`) accordingly

### First Deploy

After the first successful deployment, push your database schema:

```bash
DATABASE_URL="<your-db-url>" pnpm db:push
```

### Custom Domain

Add via the dashboard under **App > Settings > Domains**, or in `.do/app.yaml`:

```yaml
domains:
  - domain: yourdomain.com
    type: PRIMARY
```

Then CNAME your domain to the `.ondigitalocean.app` URL.
