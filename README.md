Dochat - AI Customer Support Agent SAAS

## Tech Stack

- **Framework:** Next.js 15 (Turbopack)
- **Monorepo:** pnpm workspaces + Turborepo
- **Database:** PostgreSQL + Prisma
- **Auth:** Clerk
- **Payments:** DodoPayments
- **AI:** DigitalOcean GenAI Platform
- **File Uploads:** DigitalOcean GenAI (presigned URLs)

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

## Local Development

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env   # then fill in your values

# Generate Prisma client & push schema
pnpm db:generate
pnpm db:push

# Start dev servers
pnpm dev
```

The web app runs on `http://localhost:3005` and the widget on `http://localhost:3006`.

## Environment Variables

Create a `.env` file in the project root with the following:

```env
# Database
DATABASE_URL=

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# DigitalOcean GenAI
DIGITALOCEAN_API_TOKEN=
DO_PROJECT_ID=
DO_AGENT_REGION=
DO_AGENT_MODEL_UUID=
DO_EMBEDDING_MODEL_UUID=

# Widget
NEXT_PUBLIC_WIDGET_URL=http://localhost:3006

# DodoPayments
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_ENVIRONMENT=
DODO_PAYMENTS_WEBHOOK_SECRET=
DODO_STARTER_PRODUCT_ID=
DODO_GROWTH_PRODUCT_ID=
DODO_SCALE_PRODUCT_ID=
```

## Deploying to DigitalOcean App Platform

### Prerequisites

1. A [DigitalOcean](https://www.digitalocean.com/) account
2. Your code pushed to a GitHub repository
3. [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) CLI installed and authenticated:
   ```bash
   brew install doctl
   doctl auth init   # paste your DO API token when prompted
   ```
4. GitHub connected to your DigitalOcean account — go to the [App Platform](https://cloud.digitalocean.com/apps) dashboard, click **Create App**, and authorize GitHub access to your repo.

### Steps

1. **Update the app spec** — open `.do/app.yaml` and replace the GitHub repo for both the `web` and `widget` services with your actual repo (e.g. `dimasna/dochat`).

2. **Deploy** — run the deploy script, which reads secrets from your local `.env` and injects them at deploy time (nothing secret is committed to git):
   ```bash
   bash .do/deploy.sh
   ```

3. **Run database migrations** — after the first deploy completes:
   ```bash
   # Option A: via doctl console
   doctl apps console <app-id> web -- npx prisma db push

   # Option B: connect locally using the managed DB connection string
   #           (find it in App Platform > Database > Connection Details)
   DATABASE_URL="<managed-db-url>" pnpm db:push
   ```

4. **Verify** — your app will be live at the URL shown in the App Platform dashboard (e.g. `https://dochat-xxxxx.ondigitalocean.app`).

### Custom Domain

Add a custom domain via the dashboard under **App > Settings > Domains**, or update `.do/app.yaml`:

```yaml
domains:
  - domain: yourdomain.com
    type: PRIMARY
```

Then point your DNS to the app (CNAME record to the `.ondigitalocean.app` URL).

### What the Deploy Script Does

- Reads your local `.env` file (never committed to git)
- Generates a temporary app spec with secrets injected
- Creates or updates the app via `doctl`
- Deletes the temporary spec — secrets never persist on disk
