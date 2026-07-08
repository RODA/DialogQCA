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
npm run check
npm run build
npm run build -- --sign
```

`npm run build` uses the current host OS. On macOS, the default build is
ad-hoc signed so the app bundle remains valid without private signing
credentials. Use `--sign` only when a maintainer intentionally wants Developer
ID signing and has a valid signing identity.

The compiled desktop application is staged in the product repository under
`dist/`. Installers, update metadata, and other release artifacts are written
under `build/output/`.

Set `DIALOGFORGE_ROOT` when DialogForge is not a sibling checkout.

## CI Builds

`.github/workflows/build.yml` builds Linux, Windows, and macOS artifacts from
the DialogQCA repository.
