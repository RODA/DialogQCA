# Build And Release

DialogQCA owns its public build entry points. DialogForge is used as the shared
engine.

Start with the canonical DialogForge product-authoring manual:

```text
DialogForge/internal/product-authoring.md
```

## Local Builds

Use a sibling checkout by default:

```text
<workspace>/DialogForge
<workspace>/DialogQCA
```

Then run commands from the DialogQCA repository:

```sh
npm start
npm run check
npm run build
npm run build -- --sign
```

`npm start` builds and launches DialogQCA in Electron development mode with
DevTools open. It watches product files, restaging and restarting the
application when they change. It uses the sibling DialogForge checkout by
default. For another location, either set `DIALOGFORGE_ROOT` or pass it
explicitly:

```sh
npm start -- --forge-path /path/to/DialogForge
```

`npm run build` uses the current host OS. On macOS, the default build is
ad-hoc signed so the app bundle remains valid without private signing
credentials. Use `--sign` only when a maintainer intentionally wants Developer
ID signing and has a valid signing identity.

The compiled desktop application is staged in the product repository under
`dist/`. Installers, update metadata, and other release artifacts are written
under `build/output/`.

Release repositories are inferred or optionally configured, but release tags are
required product settings in `package.json > product.releaseTags`. In
DialogQCA, the current values are `linuxIntel=li`, `windowsIntel=wi`,
`macosIntel=mi`, `macosSilicon=ms`, and `webrVFS=web`. Treat these as
repo-specific examples for this product; other products or forks can use
different values.

DialogQCA's WebR VFS is owned by the `web` release in `RODA/DialogQCA`. Product
builds and the `webr:library` command must use that release directly.

Set `DIALOGFORGE_ROOT` when DialogForge is not a sibling checkout.

## CI Builds

`.github/workflows/build.yml` builds Linux, Windows, and macOS artifacts from
the DialogQCA repository.
