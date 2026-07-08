# Internal Maintainer Tools

This directory contains product-owned maintainer scripts. They are not part of
the public contributor workflow.

## `macos-notarization.js`

Submits and staples the signed macOS DMG for this product.

Run this only on macOS, after creating a signed Apple Silicon build:

```sh
npm run build -- --sign
node internal/macos-notarization.js submit
node internal/macos-notarization.js history
node internal/macos-notarization.js staple
```

The script reads this product's `package.json`, expects the DMG in
`build/output/`, and looks for `<Product>_silicon.dmg`.

Keychain profile lookup order:

1. `DIALOGQCA_NOTARY_PROFILE`
2. `DIALOGFORGE_NOTARY_PROFILE`
3. `developer-id-notary`

Actions:

- `submit`: submit the product DMG with `xcrun notarytool submit`.
- `history`: show the latest notarization submissions for the selected profile.
- `staple`: staple the accepted ticket with `xcrun stapler staple`.

## `deploy-web.sh`

Builds and deploys this product's web runtime to the configured server-side
product location, then installs/restarts the matching systemd service.

Default settings are read from `internal/web.env`:

```sh
DIALOGFORGE_WEB_PORT=5174
DIALOGFORGE_WEB_SERVICE=dialogqca-web
DIALOGFORGE_WEB_PUBLIC_URL=https://qca.adriandusa.com
DIALOGFORGE_DEPLOY_PRODUCT_DEST=/home/webr/dialogqca
```

Typical use from the product repository root:

```sh
./internal/deploy-web.sh
```

Useful options:

- `--config <path>`: load a different env file.
- `--forge-root <path>`: use a specific DialogForge checkout.
- `--port <port>`: override the service port.
- `--service <name>`: override the systemd service name.
- `--public-url <url>`: override the URL shown in the final summary.
- `--deploy-root <path>`: set the remote deployment root.
- `--product-dest <path>`: set this product's server-side directory.
- `--forge-dest <path>`: set the server-side DialogForge dist directory.
- `--host <host>`: set the local bind host, default `127.0.0.1`.
- `--no-build`: skip `npm run build:web`.
- `--no-verify`: skip endpoint verification.
- `--dry-run`: print resolved settings and exit.

The generated service uses `DIALOGFORGE_WEB_PRODUCT_PATH` internally so the
shared DialogForge web server loads this product without a command-line product
path.

## `sync-to-server.sh`

Copies the internal deployment helpers to the server-side product clone.

```sh
./internal/sync-to-server.sh
```

Defaults:

- SSH target: `adrian@49.13.88.42`
- Remote product root: `/home/adrian/GitHub/<ProductId>`

Override both explicitly when needed:

```sh
./internal/sync-to-server.sh user@host /path/to/product
```

The script copies only:

- `internal/deploy-web.sh`
- `internal/sync-to-server.sh`
- `internal/web.env`

## `web.env`

Product-specific deployment defaults consumed by `deploy-web.sh`. Keep only
settings that belong to this product here. Machine-specific overrides can be
passed through the environment or a separate `--config` file.
