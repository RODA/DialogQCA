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
npm run build:linux
npm run build:windows
npm run build:macos
```

Set `DIALOGFORGE_ROOT` when DialogForge is not a sibling checkout.

## CI Builds

`.github/workflows/build.yml` builds Linux, Windows, and macOS artifacts from
the DialogQCA repository.
