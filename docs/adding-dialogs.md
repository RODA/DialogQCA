# Adding DialogQCA Dialogs

This document describes how to add a DialogQCA product dialog. DialogQCA is a
DialogForge product repository, so DialogQCA owns its QCA dialogs, menu entries,
capabilities, translations, runtime profile hooks, and product tests.

Do not add DialogQCA dialogs to the DialogForge shared dialog tree. Start
DialogForge with this repository selected when you want the development import
workflow to write DialogQCA source files.

## Source Layout

Current DialogQCA dialogs live under:

```text
dialogs/source/<dialog-id>/
    dialog.json
    actions.js
```

The registry is:

```text
dialogs/dialogs.json
```

New imported packages may use the provider bucket from the package metadata.
For R-specific dialogs, prefer the canonical provider bucket:

```text
dialogs/r/<dialog-id>/
```

If you are editing an existing DialogQCA dialog, keep it in its current
directory unless you are deliberately moving and updating the registry,
menu/tests, and any references together.

`<dialog-id>` should match `properties.name` in `dialog.json`. Use a stable
identifier-style name: letters, numbers, and underscores, with no leading digit.
Existing DialogQCA examples include `calibrate`, `truthTable`, `minimize`,
`xyplot`, and `venn`.

## Starting From DialogCreator

Create or edit the dialog in DialogCreator and save it as a `.dc.zip` package.
The package is the exchange format. It must not be replaced by a loose `.json`
file.

The package should contain:

- `dialog.json`;
- `actions.js`;
- optional dialog-local support files.

When imported in product development mode, DialogForge unpacks the package into
the product dialog tree and updates `dialogs/dialogs.json`.

## Manual Import

For a new R-specific dialog, create:

```text
dialogs/r/<dialog-id>/
```

Then place:

```text
dialogs/r/<dialog-id>/dialog.json
dialogs/r/<dialog-id>/actions.js
```

For consistency with an existing DialogQCA dialog family, you may keep using the
existing `dialogs/source/<dialog-id>/` layout, but make the choice explicit in
the registry entry. Do not split one dialog across several unrelated folders.

Keep dialog-specific helpers inside the same dialog directory unless they are
reused by multiple DialogQCA dialogs.

## Registry Entry

Add an entry to `dialogs/dialogs.json`.

For a new provider-bucket dialog:

```json
{
    "id": "exampleDialog",
    "label": "Example dialog",
    "owner": "products/DialogQCA",
    "targetHome": "products/DialogQCA/dialogs/r/exampleDialog/",
    "sourceReference": "DialogCreator package or source note",
    "sourceFile": "r/exampleDialog/dialog.json",
    "status": "source-imported",
    "replacement": "Run through the DialogCreator-compatible DialogForge dialog runtime."
}
```

For an existing `source`-layout dialog, keep `sourceFile` and `targetHome`
aligned with that directory:

```json
"sourceFile": "source/calibrate/dialog.json"
```

## Menu Placement

DialogQCA menu entries live in:

```text
menu/menu.json
```

Use `type: "product-dialog"` and set `dialog` to the dialog registry ID.

Choose the top-level menu by user workflow:

- `Data` for calibration and condition recoding;
- `Analyze` for truth-table, inconsistency, and minimization workflows;
- `Graphs` for plotting and diagram dialogs.

Example:

```json
{
    "id": "QcaExampleDialog",
    "labelKey": "menu.root.analyze.example_dialog",
    "label": "Example dialog",
    "type": "product-dialog",
    "dialog": "exampleDialog",
    "capability": "qca.dialog.exampleDialog"
}
```

`id` is the menu item ID. `dialog` is the dialog ID from `dialogs/dialogs.json`.
Keep them distinct.

## Product Capabilities

Add a matching capability to:

```text
capabilities/product-capabilities.json
```

DialogQCA capability names use this pattern:

```text
qca.dialog.<dialog-id>
```

Example:

```json
{
    "capability": "qca.dialog.exampleDialog",
    "label": "Example dialog",
    "runtimePrerequisites": [
        {
            "provider": "r",
            "kind": "package",
            "name": ["QCA"]
        }
    ]
}
```

The capability entry describes the QCA feature and any explicit runtime
prerequisites. Keep this entry in product language: the dialog name, its label,
and the packages or provider-specific prerequisites it needs. DialogForge derives
and validates its lower-level runtime requirements from the dialog package,
product metadata, and runtime provider contract.

Most QCA dialogs should declare a `QCA` package prerequisite. Add `venn`,
`admisc`, or other packages only when that dialog actually needs them. Future
non-R runtime providers can use their own provider and prerequisite kind.

## Translations

The menu item should have a stable `labelKey`. Add that key to each DialogQCA
locale file under:

```text
i18n/*.json
```

Dialog-local labels and control text belong in the dialog package's `dialog.json`
`i18n` section. Product menu labels belong in DialogQCA locale files.

## Product-Specific Behavior

Dialog behavior belongs in `actions.js` when it is local to one dialog.

If the dialog needs QCA-specific behavior, such as calibration previews,
truth-table state, XY plot rendering, Venn rendering, or product external calls,
route through DialogQCA-owned product modules and existing dialog external-call
conventions. Do not call Electron IPC, DOM internals outside the dialog runtime,
or DialogForge private implementation files directly from `actions.js`.

If new shared DialogQCA dialog behavior is needed, add it as a product-owned
helper and test it. Promote code to DialogForge shared code only when it is
truly reusable outside DialogQCA.

## Menu Customization In Development

When DialogForge is started with this repository selected, menu customization's
Browse action imports `.dc.zip` packages into this repository. It should create
or update:

```text
dialogs/<provider>/<dialog-id>/
dialogs/dialogs.json
```

Review those changes before committing. The UI can help place a menu item, but
the committed source of truth is still `menu/menu.json`, not a user-local menu
customization file.

## Validation

After adding a dialog, run:

```sh
npm run check
```

For rendered behavior, use the product electron dialog verifier when needed:

```sh
npm run verify:electron-dialog
```

Also check the relevant dialog-runtime tests under `tests/dialog-runtime/`.
If the new dialog adds product-specific external calls, previews, rendering, or
runtime-profile behavior, add focused product tests under `tests/products/` or
`tests/dialog-runtime/`.

## Review Checklist

Before committing:

- the dialog directory contains `dialog.json` and `actions.js`;
- `dialogs/dialogs.json` has the dialog ID and correct `sourceFile`;
- `menu/menu.json` has a `product-dialog` entry where DialogQCA users expect it;
- `capabilities/product-capabilities.json` has the matching capability;
- menu `labelKey` values exist in `i18n/*.json`;
- runtime prerequisites are declared on the capability when needed;
- DialogQCA product tests cover any new non-trivial behavior.
