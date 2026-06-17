# Developing against locally-linked packages

This project depends on three Camptocamp packages that you may need to patch and
test locally before publishing:

- `@camptocamp/ogc-client` → `~/Sites/ogc-client`
- `@geospatial-sdk/core` → `~/Sites/geospatial-sdk/packages/core`
- `@geospatial-sdk/openlayers` → `~/Sites/geospatial-sdk/packages/openlayers`

The procedure below wires those local checkouts into `sextant-viewer` via
`npm link`. It is intentionally precise — `npm link` is fragile here for two
reasons:

1. **Nested duplicate.** `@geospatial-sdk/openlayers` has its own nested
   `node_modules/@camptocamp/ogc-client`. If that copy is the unpatched published
   version, WMS dimension parsing (and anything else patched in ogc-client)
   silently does nothing, because openlayers resolves the nested copy instead of
   the linked one.
2. **Silent clobbering.** Running `npm install`, or running `npm link` for the
   three packages in separate commands, overwrites the symlinks with the
   published copies again — without any error.

## One-time setup

### 1. Build the local repos

Rebuild after any source change in them (the app consumes the built `dist/`,
not the TypeScript sources):

```bash
cd ~/Sites/ogc-client && npm run build
cd ~/Sites/geospatial-sdk/packages/core && npm run build
cd ~/Sites/geospatial-sdk/packages/openlayers && npm run build
```

### 2. Register the global links

```bash
cd ~/Sites/ogc-client && npm link
cd ~/Sites/geospatial-sdk/packages/core && npm link
cd ~/Sites/geospatial-sdk/packages/openlayers && npm link

# Link the patched ogc-client INTO geospatial-sdk so @geospatial-sdk/openlayers
# uses it instead of its own nested (unpatched) copy.
cd ~/Sites/geospatial-sdk && npm link @camptocamp/ogc-client
```

### 3. Link all three into sextant-viewer — in a SINGLE command

```bash
cd ~/Sites/sextant-viewer
npm link @camptocamp/ogc-client @geospatial-sdk/core @geospatial-sdk/openlayers
```

> ⚠️ Must be one command. Linking them separately makes npm reinstall published
> copies over the earlier links.

### 4. Verify the links took

```bash
ls -la node_modules/@geospatial-sdk node_modules/@camptocamp/ogc-client
```

Every entry must be a symlink (`-> ../../...`). If any is a real directory,
re-run step 3.

## Running the dev server

Start Vite with the linked-packages flag:

```bash
USE_LINKED_PACKAGES=1 npm run dev
```

`vite.config.ts` gates a set of `resolve.alias` + `optimizeDeps.exclude` rules
behind `USE_LINKED_PACKAGES=1`. They force every import — including the
transitive `@camptocamp/ogc-client` pulled in by `@geospatial-sdk/openlayers` —
to resolve to the single linked copy, and stop Vite from pre-bundling a
stale/duplicate version. Without the flag the committed config is unchanged, so
CI and other developers keep using the published packages.

Optional convenience script in `package.json`:

```json
"dev:linked": "USE_LINKED_PACKAGES=1 vite"
```

## Gotchas

- **Do not run `npm install` while linked** — it overwrites the symlinks. If you
  must, re-run step 3 afterwards.
- **Rebuild after editing the local repos** (step 1). The app uses the built
  `dist/`. For `@camptocamp/ogc-client`, the WMS capabilities parser also runs
  inside a web-worker blob embedded in `dist/dist-node.js`; a full
  `npm run build` regenerates both the outer code and the worker blob.
- **Vite caching.** If a change still isn't reflected, clear the dep cache and
  restart: `rm -rf node_modules/.vite && USE_LINKED_PACKAGES=1 npm run dev`.

## Reverting to published packages

```bash
cd ~/Sites/sextant-viewer
npm install        # restores the published versions over the symlinks
npm run dev        # run WITHOUT USE_LINKED_PACKAGES
```
