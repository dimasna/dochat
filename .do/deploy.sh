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

# Helper to look up a key from .env
get_env() {
  local lookup_key="$1"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    if [ "$key" = "$lookup_key" ]; then
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      echo "$value"
      return
    fi
  done < "$ENV_FILE"
}

# Read the base spec
spec=$(cat "$SPEC_FILE")

# Env vars to inject into the "web" service
WEB_SECRETS=(
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
)

# Secrets that should be encrypted
ENCRYPTED_KEYS=(
  CLERK_SECRET_KEY
  DIGITALOCEAN_API_TOKEN
  DODO_PAYMENTS_API_KEY
  DODO_PAYMENTS_WEBHOOK_SECRET
)

# Build the extra env entries into a temp file
env_entries=$(mktemp)
for key in "${WEB_SECRETS[@]}"; do
  val="$(get_env "$key")"
  if [ -z "$val" ]; then
    echo "Warning: $key not found in .env, skipping"
    continue
  fi

  is_secret="false"
  for skey in "${ENCRYPTED_KEYS[@]}"; do
    if [ "$key" = "$skey" ]; then
      is_secret="true"
      break
    fi
  done

  if [ "$is_secret" = "true" ]; then
    printf '      - key: %s\n        value: "%s"\n        scope: RUN_AND_BUILD_TIME\n        type: SECRET\n' "$key" "$val" >> "$env_entries"
  else
    printf '      - key: %s\n        value: "%s"\n        scope: RUN_AND_BUILD_TIME\n' "$key" "$val" >> "$env_entries"
  fi
done

# Generate the final spec by injecting env vars after the NEXT_PUBLIC_WIDGET_URL block
tmp_spec=$(mktemp)
awk '
  /key: NEXT_PUBLIC_WIDGET_URL/ {
    found=1
  }
  found && /scope: RUN_AND_BUILD_TIME/ {
    print
    while ((getline line < "'"$env_entries"'") > 0) print line
    found=0
    next
  }
  { print }
' "$SPEC_FILE" > "$tmp_spec"
rm -f "$env_entries"

echo ""
echo "=== Deploying dochat to DigitalOcean App Platform ==="
echo "Spec: $SPEC_FILE"
echo "Env:  $ENV_FILE"
echo "Injecting ${#WEB_SECRETS[@]} env vars from .env"
echo ""

# Check if app already exists
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
