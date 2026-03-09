#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SPEC_FILE="$SCRIPT_DIR/app.yaml"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

if ! command -v doctl &> /dev/null; then
  echo "Error: doctl not installed. Run: brew install doctl"
  exit 1
fi

# --- Read a key from .env ---
get_env() {
  local lookup_key="$1"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    if [ "$key" = "$lookup_key" ]; then
      value="${value%\"}" ; value="${value#\"}"
      value="${value%\'}" ; value="${value#\'}"
      echo "$value"
      return
    fi
  done < "$ENV_FILE"
}

# --- Env vars to inject (replaces __KEY__ placeholders in app.yaml) ---
# Add new env vars here AND in app.yaml with __KEY__ placeholder format.
SECRETS=(
  DATABASE_URL
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  DIGITALOCEAN_API_TOKEN
  DO_PROJECT_ID
  DO_AGENT_REGION
  DO_AGENT_MODEL_UUID
  DO_EMBEDDING_MODEL_UUID
  DODO_PAYMENTS_API_KEY
  DODO_PAYMENTS_ENVIRONMENT
  DODO_PAYMENTS_WEBHOOK_SECRET
  DODO_STARTER_PRODUCT_ID
  DODO_GROWTH_PRODUCT_ID
  DODO_SCALE_PRODUCT_ID
  NEXT_PUBLIC_LANDING_WIDGET_ORG_ID
  NEXT_PUBLIC_LANDING_WIDGET_AGENT_ID
)

# --- Build final spec by replacing __KEY__ placeholders ---
tmp_spec=$(mktemp)
cp "$SPEC_FILE" "$tmp_spec"

injected=0
for key in "${SECRETS[@]}"; do
  val="$(get_env "$key")"
  if [ -z "$val" ]; then
    echo "Warning: $key not found in .env, skipping"
    continue
  fi
  # Use | as sed delimiter to avoid conflicts with URLs
  sed -i.bak "s|__${key}__|${val}|g" "$tmp_spec"
  injected=$((injected + 1))
done
rm -f "${tmp_spec}.bak"

echo ""
echo "=== Deploying dochat to DigitalOcean App Platform ==="
echo "Spec: $SPEC_FILE"
echo "Env:  $ENV_FILE"
echo "Injected $injected env vars from .env"
echo ""

# --- Create or update app ---
APP_ID=$(doctl apps list --format ID,Spec.Name --no-header 2>/dev/null | grep dochat | awk '{print $1}' || true)

if [ -n "$APP_ID" ]; then
  echo "Updating existing app: $APP_ID"
  doctl apps update "$APP_ID" --spec "$tmp_spec"
else
  echo "Creating new app..."
  doctl apps create --spec "$tmp_spec"
fi

rm -f "$tmp_spec"

echo ""
echo "Done! View your app at: https://cloud.digitalocean.com/apps"
