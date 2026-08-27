# DialogQCA
A QCA product for DialogForge

## Public NPM Scripts

Run these commands from the DialogQCA repository. DialogForge should normally be a
sibling checkout at `../DialogForge`; set `DIALOGFORGE_ROOT` when it is
somewhere else.

| Command | Public arguments | What it does |
| --- | --- | --- |
| `npm start` | optional `-- --forge-path <path>` | Builds and starts DialogQCA in Electron development mode with DevTools open, then restages and restarts it when product files change. Uses the sibling `../DialogForge` checkout by default or `DIALOGFORGE_ROOT` when set. |
| `npm run check` | none | Validates the DialogQCA product contribution, TypeScript sources, and structured R package requirements. |
| `npm run build` | macOS-only `--sign` | Runs `check`, then asks DialogForge to build/package DialogQCA for the current host OS. macOS builds are ad-hoc signed unless `--sign` is passed. |
| `npm run check:build-ownership` | none | Checks that DialogQCA keeps its product-owned build scripts and release request workflow. |
| `npm run webr:library` | optional `-- --force` | Downloads or refreshes DialogQCA WebR package-library assets. |
| `npm run webr:manifest` | none | Regenerates the installed-package manifest from the local WebR VFS metadata and data pair. |
| `npm run test:package-compatibility` | none | Verifies the shared structured-requirement contract and generated DialogQCA manifest. |
| `npm run verify:electron-dialog` | none | Runs the DialogQCA Electron dialog verification script. |
| `npm run dev:web` | optional `--port <number>` and `--host <address>` | Builds DialogForge's web runtime for DialogQCA and starts the local server, replacing an existing server on the selected port. |
| `npm run build:web` | none | Builds DialogForge's web runtime and DialogQCA web manifest without starting the server. |
| `npm run serve:web` | optional `--port <number>` and `--host <address>` | Serves the already-built DialogQCA web runtime without rebuilding DialogForge first. |
| `npm run verify:web-deployment` | optional base URL | Checks the expected DialogQCA web deployment endpoints. Defaults to `DIALOGQCA_WEB_URL` or `http://127.0.0.1:5173`. |

The compiled desktop application is staged in this repository under `dist/`.
Installers, update metadata, and other release artifacts are written under
`build/output/`.

Official notarization and release publication are maintainer-internal operations.
Developer ID macOS signing is opt-in with `npm run build -- --sign` when the
caller has a valid signing identity. Without `--sign`, macOS artifacts are
ad-hoc signed so the app bundle remains valid for local testing and updates,
but they are not notarized for Gatekeeper.

Release tag names are required product settings in
`package.json > product.releaseTags`. For DialogQCA, the current values are
`linuxIntel=li`, `windowsIntel=wi`, `macosIntel=mi`, `macosSilicon=ms`, and
`webrVFS=web`. These names and values are product-specific examples for this
repo and can differ across other products or user forks.

## Contributing Dialogs

See [docs/adding-dialogs.md](docs/adding-dialogs.md) for the DialogQCA procedure
for adding or editing dialogs, linking them to product menus, declaring runtime
capabilities, and validating product-specific behavior.
