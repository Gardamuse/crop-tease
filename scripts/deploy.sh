#!/bin/bash
# Builds the app and copies it to the web server over SSH.
#   scripts/deploy.sh prod | beta
# Where it goes comes from the environment or scripts/deploy.env
# (git-ignored; see scripts/deploy.env.example).
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f scripts/deploy.env ]; then source scripts/deploy.env; fi

target="${1:-}"
case "$target" in
  prod) prefix=PROD ;;
  beta) prefix=BETA ;;
  *) echo "Usage: $0 prod|beta" >&2; exit 1 ;;
esac

base_var="${prefix}_BASE_URL"
dir_var="${prefix}_DIR"
: "${DEPLOY_HOST:?Set DEPLOY_HOST=user@host, e.g. in scripts/deploy.env}"
: "${!base_var:?Set $base_var (the URL the app is served from), e.g. in scripts/deploy.env}"
: "${!dir_var:?Set $dir_var (the folder on the server), e.g. in scripts/deploy.env}"
base_url="${!base_var}"
dir="${!dir_var}"

npm run build -- --base="$base_url"
ssh "$DEPLOY_HOST" "mkdir -p '$dir'"
tar cf - -C dist . | pv | ssh "$DEPLOY_HOST" "tar xf - -C '$dir'"
