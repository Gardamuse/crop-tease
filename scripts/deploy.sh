#!/bin/bash
set -euo pipefail

# The server comes from DEPLOY_HOST (user@host), set in the environment or in
# scripts/deploy.env (git-ignored; see scripts/deploy.env.example).
cd "$(dirname "$0")/.."
if [ -f scripts/deploy.env ]; then source scripts/deploy.env; fi
: "${DEPLOY_HOST:?Set DEPLOY_HOST=user@host, e.g. in scripts/deploy.env}"

npm run build -- --base="https://www.blushingdefeat.com/play/crop-tease/"
ssh "$DEPLOY_HOST" "mkdir -p blushing-server/data/play/crop-tease"
tar cf - -C dist . | pv | ssh "$DEPLOY_HOST" "tar xf - -C blushing-server/data/play/crop-tease"
