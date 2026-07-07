# Internal Notes

This directory is for DialogQCA maintainer notes and implementation details that
are not part of the public contributor documentation.

Current internal release boundary:

- public product builds are documented in `README.md` and `docs/`;
- official Windows release signing is maintainer-only and goes through the
  private DialogForge signing broker;
- the `release-windows.yml` workflow requires `DIALOGFORGE_SIGNING_TOKEN`;
- macOS signing and notarization are maintainer release operations and should
  not be exposed as public npm commands.

## Hetzner Web Deployment

`internal/hetzner/deploy-web.sh` is the maintainer-only deployment entry point
for the browser build. It is intentionally not exposed as an npm script and
should not be part of the public product repository.

The script is product-generic: it reads product identity from `package.json`,
uses this repository as the selected product, and delegates the web build to
the product-local `npm run build:web` command. That build writes the web runtime
to `dist/web` inside this repository, and deployment syncs that
product-owned output to Hetzner. Product-specific deployment settings live in
`internal/hetzner/web.env`.

The port is deployment configuration, not product metadata. DialogQCA currently
uses port `5174`, service `dialogqca-web`, and public URL
`https://qca.adriandusa.com`. A one-off deployment can override the config
with `--port`, `--service`, `--public-url`, or the corresponding environment
variables. Use `--dry-run` to inspect the resolved deployment settings without
touching the server.

Because `internal/` is private, send the deployment scripts to Hetzner with:

```sh
internal/hetzner/sync-to-server.sh
```

Then run `internal/hetzner/deploy-web.sh` from the product clone on Hetzner.
