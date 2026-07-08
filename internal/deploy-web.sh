#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_PATH="$SCRIPT_DIR/web.env"
ORIGINAL_ARGS=("$@")

usage() {
    cat <<USAGE
Usage: ./internal/deploy-web.sh [options]

Options:
  --config <path>          Read deployment settings from another env file.
  --forge-root <path>      DialogForge checkout. Defaults to ../DialogForge.
  --port <port>            Local service port. Required unless configured.
  --service <name>         systemd service name.
  --public-url <url>       Public URL shown in the final summary.
  --deploy-root <path>     Deployment root. Defaults to /home/webr.
  --product-dest <path>    Product deployment directory.
  --forge-dest <path>      DialogForge dist deployment directory.
  --host <host>            Local bind host. Defaults to 127.0.0.1.
  --no-build               Skip npm run build:web.
  --no-verify              Skip endpoint and product deployment verification.
  --dry-run                Print resolved deployment settings and exit.
  -h, --help               Show this help.

Settings may also be provided through the matching DIALOGFORGE_* environment
variables documented in internal/web.env.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --config)
            CONFIG_PATH="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

if [[ -f "$CONFIG_PATH" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_PATH"
fi

PRODUCT_ID="$(
    node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(String((pkg.product || {}).id || ""));' \
        "$PRODUCT_ROOT/package.json"
)"
PRODUCT_NAME="$(
    node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const product = pkg.product || {}; process.stdout.write(String(product.name || product.displayName || product.id || pkg.name || ""));' \
        "$PRODUCT_ROOT/package.json"
)"
PRODUCT_SLUG="$(
    printf "%s" "$PRODUCT_ID" \
        | tr "[:upper:]" "[:lower:]" \
        | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
)"

DIALOGFORGE_ROOT="${DIALOGFORGE_ROOT:-$(cd "$PRODUCT_ROOT/.." && pwd)/DialogForge}"
DIALOGFORGE_DEPLOY_USER="${DIALOGFORGE_DEPLOY_USER:-webr}"
DIALOGFORGE_DEPLOY_GROUP="${DIALOGFORGE_DEPLOY_GROUP:-$DIALOGFORGE_DEPLOY_USER}"
DIALOGFORGE_DEPLOY_ROOT="${DIALOGFORGE_DEPLOY_ROOT:-/home/webr}"
DIALOGFORGE_DEPLOY_FORGE_DEST="${DIALOGFORGE_DEPLOY_FORGE_DEST:-$DIALOGFORGE_DEPLOY_ROOT/dist}"
DIALOGFORGE_DEPLOY_PRODUCT_DEST="${DIALOGFORGE_DEPLOY_PRODUCT_DEST:-$DIALOGFORGE_DEPLOY_ROOT/$PRODUCT_SLUG}"
PRODUCT_WEB_DIST="$PRODUCT_ROOT/dist/web"
DIALOGFORGE_WEB_SERVICE="${DIALOGFORGE_WEB_SERVICE:-$PRODUCT_SLUG-web}"
DIALOGFORGE_WEB_HOST="${DIALOGFORGE_WEB_HOST:-127.0.0.1}"
DIALOGFORGE_WEB_BUILD="${DIALOGFORGE_WEB_BUILD:-1}"
DIALOGFORGE_WEB_VERIFY="${DIALOGFORGE_WEB_VERIFY:-1}"
DIALOGFORGE_WEB_DRY_RUN="${DIALOGFORGE_WEB_DRY_RUN:-0}"
DIALOGFORGE_WEB_PORT="${DIALOGFORGE_WEB_PORT:-}"
DIALOGFORGE_WEB_PUBLIC_URL="${DIALOGFORGE_WEB_PUBLIC_URL:-}"

set -- "${ORIGINAL_ARGS[@]}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --config)
            shift 2
            ;;
        --forge-root)
            DIALOGFORGE_ROOT="$2"
            shift 2
            ;;
        --port)
            DIALOGFORGE_WEB_PORT="$2"
            shift 2
            ;;
        --service)
            DIALOGFORGE_WEB_SERVICE="$2"
            shift 2
            ;;
        --public-url)
            DIALOGFORGE_WEB_PUBLIC_URL="$2"
            shift 2
            ;;
        --deploy-root)
            DIALOGFORGE_DEPLOY_ROOT="$2"
            DIALOGFORGE_DEPLOY_FORGE_DEST="$DIALOGFORGE_DEPLOY_ROOT/dist"
            DIALOGFORGE_DEPLOY_PRODUCT_DEST="$DIALOGFORGE_DEPLOY_ROOT/$PRODUCT_SLUG"
            shift 2
            ;;
        --product-dest)
            DIALOGFORGE_DEPLOY_PRODUCT_DEST="$2"
            shift 2
            ;;
        --forge-dest)
            DIALOGFORGE_DEPLOY_FORGE_DEST="$2"
            shift 2
            ;;
        --host)
            DIALOGFORGE_WEB_HOST="$2"
            shift 2
            ;;
        --no-build)
            DIALOGFORGE_WEB_BUILD=0
            shift
            ;;
        --no-verify)
            DIALOGFORGE_WEB_VERIFY=0
            shift
            ;;
        --dry-run)
            DIALOGFORGE_WEB_DRY_RUN=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -z "$PRODUCT_ID" || -z "$PRODUCT_SLUG" ]]; then
    echo "Product id could not be read from $PRODUCT_ROOT/package.json." >&2
    exit 1
fi

if [[ ! -f "$DIALOGFORGE_ROOT/package.json" ]]; then
    echo "DialogForge checkout not found: $DIALOGFORGE_ROOT" >&2
    exit 1
fi

if [[ -z "$DIALOGFORGE_WEB_PORT" ]]; then
    echo "DIALOGFORGE_WEB_PORT is required. Set it in $CONFIG_PATH or pass --port." >&2
    exit 1
fi

BASE_URL="http://$DIALOGFORGE_WEB_HOST:$DIALOGFORGE_WEB_PORT"

echo "== Deployment =="
echo "Product: $PRODUCT_NAME ($PRODUCT_ID)"
echo "Product source: $PRODUCT_ROOT"
echo "DialogForge source: $DIALOGFORGE_ROOT"
echo "Product destination: $DIALOGFORGE_DEPLOY_PRODUCT_DEST"
echo "Web runtime source: $PRODUCT_WEB_DIST"
echo "Web runtime destination: $DIALOGFORGE_DEPLOY_FORGE_DEST"
echo "Service: $DIALOGFORGE_WEB_SERVICE"
echo "Local URL: $BASE_URL"

if [[ "$DIALOGFORGE_WEB_DRY_RUN" != "0" ]]; then
    echo "Dry run only. No build, sync, systemd, or verification commands were run."
    exit 0
fi

echo "== Checking DialogForge dependencies =="
cd "$DIALOGFORGE_ROOT"
if [[ ! -d "node_modules" ]]; then
    npm ci
fi

if [[ "$DIALOGFORGE_WEB_BUILD" != "0" ]]; then
    echo "== Building $PRODUCT_NAME web runtime =="
    cd "$PRODUCT_ROOT"
    npm run build:web
fi

if [[ ! -f "$PRODUCT_WEB_DIST/scripts/web-product-dev-server.js" ]]; then
    echo "Product web runtime was not built at $PRODUCT_WEB_DIST." >&2
    exit 1
fi

echo "== Syncing product web runtime =="
sudo mkdir -p "$DIALOGFORGE_DEPLOY_FORGE_DEST"
sudo rsync -a --delete "$PRODUCT_WEB_DIST/" "$DIALOGFORGE_DEPLOY_FORGE_DEST/"

echo "== Syncing $PRODUCT_NAME product =="
sudo mkdir -p "$DIALOGFORGE_DEPLOY_PRODUCT_DEST"
sudo rsync -a --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    "$PRODUCT_ROOT/" "$DIALOGFORGE_DEPLOY_PRODUCT_DEST/"

echo "== Fixing ownership =="
sudo chown -R "$DIALOGFORGE_DEPLOY_USER:$DIALOGFORGE_DEPLOY_GROUP" "$DIALOGFORGE_DEPLOY_FORGE_DEST"
sudo chown -R "$DIALOGFORGE_DEPLOY_USER:$DIALOGFORGE_DEPLOY_GROUP" "$DIALOGFORGE_DEPLOY_PRODUCT_DEST"

SERVICE_FILE="/etc/systemd/system/$DIALOGFORGE_WEB_SERVICE.service"

echo "== Writing systemd service =="
sudo tee "$SERVICE_FILE" >/dev/null <<SERVICE_UNIT
[Unit]
Description=$PRODUCT_NAME Web
After=network.target

[Service]
Type=simple
User=$DIALOGFORGE_DEPLOY_USER
Group=$DIALOGFORGE_DEPLOY_GROUP
WorkingDirectory=$DIALOGFORGE_DEPLOY_FORGE_DEST
Environment=DIALOGFORGE_WEB_PRODUCT_PATH=$DIALOGFORGE_DEPLOY_PRODUCT_DEST
ExecStart=/usr/bin/node scripts/web-product-dev-server.js --host $DIALOGFORGE_WEB_HOST --port $DIALOGFORGE_WEB_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE_UNIT

echo "== Restarting service =="
sudo systemctl daemon-reload
sudo systemctl enable "$DIALOGFORGE_WEB_SERVICE" >/dev/null
sudo systemctl restart "$DIALOGFORGE_WEB_SERVICE"

if ! sudo systemctl is-active --quiet "$DIALOGFORGE_WEB_SERVICE"; then
    echo "$DIALOGFORGE_WEB_SERVICE failed to stay active after restart." >&2
    sudo systemctl status "$DIALOGFORGE_WEB_SERVICE" --no-pager || true
    sudo journalctl -u "$DIALOGFORGE_WEB_SERVICE" -n 80 --no-pager || true
    exit 1
fi

if [[ "$DIALOGFORGE_WEB_VERIFY" != "0" ]]; then
    echo "== Waiting for service readiness =="
    for attempt in {1..40}; do
        if curl -fsS "$BASE_URL/api/composition" >/dev/null; then
            echo "$PRODUCT_NAME service is ready."
            break
        fi

        if [[ "$attempt" -eq 40 ]]; then
            echo "$PRODUCT_NAME service did not become ready in time." >&2
            sudo systemctl status "$DIALOGFORGE_WEB_SERVICE" --no-pager || true
            sudo journalctl -u "$DIALOGFORGE_WEB_SERVICE" -n 80 --no-pager || true
            exit 1
        fi

        sleep 0.5
    done

    echo "== Verifying required endpoints =="
    curl -fsS "$BASE_URL/" >/dev/null
    curl -fsS "$BASE_URL/api/composition" >/dev/null
    curl -fsS "$BASE_URL/vendor/preact/preact.module.js" >/dev/null
    curl -fsS "$BASE_URL/vendor/preact/hooks.module.js" >/dev/null
    curl -fsS "$BASE_URL/webr/webr.js" >/dev/null
    curl -fsS "$BASE_URL/monaco/vs/loader.js" >/dev/null
    curl -fsS "$BASE_URL/webr-library/library.data.gz" >/dev/null
    curl -fsS "$BASE_URL/webr-library/library.js.metadata" >/dev/null

    if [[ -f "$PRODUCT_ROOT/scripts/verify-web-deployment.js" ]]; then
        echo "== Running $PRODUCT_NAME deployment verifier =="
        node "$PRODUCT_ROOT/scripts/verify-web-deployment.js" "$BASE_URL"
    elif [[ -f "$DIALOGFORGE_ROOT/scripts/verify-web-deployment.js" ]]; then
        echo "== Running DialogForge deployment verifier =="
        node "$DIALOGFORGE_ROOT/scripts/verify-web-deployment.js" "$BASE_URL"
    fi
fi

echo
echo "Deployment OK."
if [[ -n "$DIALOGFORGE_WEB_PUBLIC_URL" ]]; then
    echo "$PRODUCT_NAME: $DIALOGFORGE_WEB_PUBLIC_URL -> $BASE_URL ($DIALOGFORGE_WEB_SERVICE)"
else
    echo "$PRODUCT_NAME: $BASE_URL ($DIALOGFORGE_WEB_SERVICE)"
fi
