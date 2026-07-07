#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRODUCT_ID="$(
    node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(String((pkg.product || {}).id || ""));' \
        "$PRODUCT_ROOT/package.json"
)"

usage() {
    cat <<USAGE
Usage: ./internal/hetzner/sync-to-server.sh [ssh-target] [remote-product-root]

Copies this private internal/hetzner directory to the product clone on Hetzner.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

SSH_TARGET="${1:-adrian@49.13.88.42}"
REMOTE_PRODUCT_ROOT="${2:-/home/adrian/GitHub/$PRODUCT_ID}"

if [[ -z "$SSH_TARGET" ]]; then
    usage >&2
    exit 2
fi

if [[ -z "$PRODUCT_ID" ]]; then
    echo "Product id could not be read from $PRODUCT_ROOT/package.json." >&2
    exit 1
fi

ssh "$SSH_TARGET" "mkdir -p '$REMOTE_PRODUCT_ROOT/internal/hetzner'"
rsync -a --delete "$SCRIPT_DIR/" "$SSH_TARGET:$REMOTE_PRODUCT_ROOT/internal/hetzner/"

echo "Synced $SCRIPT_DIR to $SSH_TARGET:$REMOTE_PRODUCT_ROOT/internal/hetzner"
