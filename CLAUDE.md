# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sextant Viewer** is a map viewer designed to be built and distributed as a **web component** (`<sxt-viewer>`). It wraps OpenLayers and MapLibre using Camptocamp's geospatial-sdk and ogc-client under the hood.

The end goal is a web component library that consumers install in their projects, pass a `MapContext` object, and get a fully functional map. The component exposes an API for map interaction and emits events for state changes.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Consumer Application                       │
│                                                                 │
│   <sxt-viewer :context="mapContext" @layer-change="handle" />   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     <sxt-viewer> Web Component                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pinia     │  │ Composables │  │      Vue Components     │  │
│  │   Stores    │◄─┤             │◄─┤  (NuxtUI + custom)      │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   MapContext (Source of Truth)          │    │
│  │  { layers: [...], view: { center, zoom }, ... }         │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌───────────────┐    ┌─────────────┐        │
│  │ geospatial  │    │  ogc-client   │    │ OpenLayers  │        │
│  │    -sdk     │───►│ (WMS/WFS/...) │───►│  Map        │        │
│  └─────────────┘    └───────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Build & Development Commands

```bash
npm run dev              # Vite dev server (http://localhost:5173)
npm run build:lib        # Build the web component library (entry: src/register.ts)
npm run build:app        # Build the standard app (vite.app.config.ts)
npm run preview          # Preview the production build (web component demo only)
npm run type-check       # vue-tsc --build
npm run lint             # ESLint with auto-fix (cached)
npm run format           # Prettier write (src/, index.html, demo/)
npm run format:check     # Prettier check (CI uses this)
npm run knip             # Detect unused files/exports/deps
npm run test:unit        # Vitest unit tests (watch)
npm run test:e2e         # Playwright E2E tests
```

Run a single test:

```bash
npm run test:unit -- src/path/to/file.spec.ts   # one Vitest file
npm run test:unit -- -t "test name"             # by test name
npm run test:e2e -- e2e/vue.spec.ts             # one Playwright spec
```

**After each iteration**: Run `npm run format` to ensure consistent code formatting before committing.

## Architecture

### MapContext as Source of Truth

All map state flows through geospatial-sdk's `MapContext` stored in Pinia:

- `computeMapContextDiff()` detects changes
- `applyContextDiffToMap()` applies updates to the map
- Bidirectional sync with circular update prevention

Direct OpenLayers manipulation is avoided unless technically impossible through the SDK.

The store works with `ExtendedMapContext` (see `map.store.ts`), which extends the SDK's `MapContext` but replaces `layers` with `MapLayer[]` (`MapLayer = (MapContextLayer | MapLayerStac) & { error?: boolean }`). A `sdkContext` computed strips the extensions back down to a plain `MapContext` before handing it to the SDK — STAC layers are converted to GeoJSON layers at that boundary. Use the `isStacLayer()` / `isBasemapLayer()` type guards in `layer.utils.ts` rather than checking `.type` inline.

### Web Component API

`SxtViewer.ce.vue` is the custom element root. Its public API is the `defineExpose` block — keep it in sync when changing capabilities:

- **Methods**: `addLayer`, `getContext`, `setContext`, `setInitialContext`, `setView`
- **Events**: `map-extent-change`

`register.ts` defines the `<sxt-viewer>` element; `main.ts` mounts the standard dev app (`App.vue`).

### Shadow DOM styling (gotcha)

The component renders inside a shadow root, so styling is non-trivial:

- `register.ts` inlines `main.css` and re-injects Tailwind's `@property` initial values into `:host` (Tailwind `@property` rules don't cross the shadow boundary). The `<length> 0 → 0px` fix there works around a box-shadow bug — don't remove it.
- `SxtViewer.ce.vue` copies the NuxtUI `[data-nuxt-ui-colors]` style tag into the shadow DOM on mount.
- Vite is configured with `vue({ features: { customElement: true } })` so component styles are embedded in the JS bundle (no separate CSS file).

### STAC subsystem

STAC (SpatioTemporal Asset Catalog) layers are a first-class layer type alongside standard OGC layers:

- `types/stac.types.ts` — `MapLayerStac` and related types
- `composables/useStacLayer.ts`, `utils/stac.utils.ts` (`enrichStacLayer`) — loading/enrichment
- `components/stac/` — filter panel, date-range/spatial filters, pagination, item indicator, details

### Persistence

`stores/persistentContext.store.ts` mirrors `initialContext` and `context` into `sessionStorage` (debounced) and restores them on load, with ignore-flags to break the restore↔watch cycle. It is instantiated for its side effects by calling `usePersistentContextStore()` in `SxtViewer.ce.vue`.

### Localization

User-facing strings are currently hard-coded in **French** (e.g. `'Couche sans titre'`, STAC error messages). Match the existing language when adding UI text.

### Project Structure

```
src/
├── register.ts                # Defines <sxt-viewer> custom element
├── main.ts / App.vue          # Standard dev app entry
├── components/
│   ├── SxtViewer.ce.vue       # Web component root + public API
│   ├── map/                   # MapViewer, FeaturePopup, loading/extent controls
│   ├── layout/                # LayoutGrid, panels, resizable dividers
│   ├── layer-manager/         # Layer list, details
│   ├── stac/                  # STAC filter/pagination/details UI
│   └── tools/                 # ToolsPanel
├── composables/               # useLayerActions, useFeatureInfo, useStacLayer, ...
├── stores/                    # Pinia: map, layers, featureSelection, persistentContext
├── constants/                 # layout constants
├── types/                     # feature-selection, stac types
└── utils/                     # map-config, layer/stac utils, feature-styles
```

### State Management

- **map.store.ts**: `ExtendedMapContext` (source of truth), view state, diff-based updates, layer CRUD
- **layers.store.ts**: UI layer selection (not map state)
- **featureSelection.store.ts**: Selected/hovered features, popup state
- **persistentContext.store.ts**: sessionStorage persistence/restore of the map context

## Technology Constraints

### Required Stack

- Vue 3.5+ with `<script setup>` and Composition API
- Pinia for state (Composition API style with setup function)
- NuxtUI 4.3+ for all UI components
- Tailwind CSS 4.0+ for styling
- TypeScript strict mode
- OpenLayers via @geospatial-sdk/core and @geospatial-sdk/openlayers

### UI Components

**Must use NuxtUI** (`@nuxt/ui`) for all UI elements. Do not create custom components when NuxtUI equivalents exist. Check https://ui.nuxt.com/docs/components before implementing any UI.

## Code Style

### Naming

- Components: `PascalCase.vue`
- Composables: `useCamelCase.ts`
- Stores: `name.store.ts`
- Types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Constraints

- Single quotes, no semicolons (Prettier)
- Line length ≤ 100 chars

### Comments

- Minimal comments - code should be self-documenting
- Explain "why" not "what"
- No task/story references (US1, T024) in code

### Immutability

Always use immutable patterns for state updates:

```typescript
// ✅ Correct
context.value = { ...context.value, layers: newLayers }

// ❌ Wrong
context.value.layers[0].visible = false
```

## Development Modes

- **Standard app**: `http://localhost:5173/index.html`
- **Web Component demo**: `http://localhost:5173/demo/index.html`

Production build only includes the web component.
