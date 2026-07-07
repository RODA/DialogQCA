# DialogQCA
A QCA product to build with DialogForge

## Public NPM Scripts

Run these commands from the DialogQCA repository. DialogForge should normally be
a sibling checkout at `../DialogForge`; set `DIALOGFORGE_ROOT` when it is
somewhere else.

| Command | Public arguments | What it does |
| --- | --- | --- |
| `npm run check` | none | Validates the DialogQCA product contribution and TypeScript sources. |
| `npm run build` | optional DialogForge packaging arguments such as `--platform linux\|windows\|macos` or `--arch arm64\|x64` | Runs `check`, then asks DialogForge to build/package DialogQCA. |
| `npm run build:linux` | none | Builds the DialogQCA Linux artifact through DialogForge. |
| `npm run build:windows` | none | Builds the DialogQCA Windows artifact through DialogForge. |
| `npm run build:macos` | none | Builds the DialogQCA macOS artifact through DialogForge. |
| `npm run check:build-ownership` | none | Checks that DialogQCA keeps its product-owned build scripts and release request workflow. |
| `npm run webr:library` | optional `-- --force` | Downloads or refreshes DialogQCA WebR package-library assets. |
| `npm run verify:electron-dialog` | none | Runs the DialogQCA Electron dialog verification script. |
| `npm run dev:web` | optional `--port <number>` and `--host <address>` | Builds DialogForge's web runtime for DialogQCA and starts the local server, replacing an existing server on the selected port. |
| `npm run build:web` | none | Builds DialogForge's web runtime and DialogQCA web manifest without starting the server. |
| `npm run serve:web` | optional `--port <number>` and `--host <address>` | Serves the already-built DialogQCA web runtime without rebuilding DialogForge first. |
| `npm run verify:web-deployment` | optional base URL | Checks the expected DialogQCA web deployment endpoints. Defaults to `DIALOGQCA_WEB_URL` or `http://127.0.0.1:5173`. |

Official signing, notarization, and release publication are maintainer-internal
operations. They are not part of the public npm script surface.

## Contributing Dialogs

See [docs/adding-dialogs.md](docs/adding-dialogs.md) for the DialogQCA procedure
for adding or editing dialogs, linking them to product menus, declaring runtime
capabilities, and validating product-specific behavior.
