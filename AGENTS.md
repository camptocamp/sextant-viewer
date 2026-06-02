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
npm run build            # Type-check + build (parallel)
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
npm run type-check       # vue-tsc type checking
npm run test:unit        # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
```

**After each iteration**: Run `npm run format` to ensure consistent code formatting before committing.

## Architecture

### MapContext as Source of Truth

All map state flows through geospatial-sdk's `MapContext` stored in Pinia:

- `computeMapContextDiff()` detects changes
- `applyContextDiffToMap()` applies updates to the map
- Bidirectional sync with circular update prevention

Direct OpenLayers manipulation is avoided unless technically impossible through the SDK.

### Project Structure

```
src/
├── components/
│   ├── SxtViewer.ce.vue      # Web component root
│   ├── map/                   # MapViewer, FeaturePopup
│   ├── layout/                # LayoutGrid, panels
│   └── layer-manager/         # Layer list, details
├── composables/               # useMapFeatureInteraction, useLayerActions
├── stores/                    # Pinia: map.store, layers.store, featureSelection.store
├── types/                     # TypeScript definitions
└── utils/                     # map-config, layer utilities
```

### State Management

- **map.store.ts**: MapContext (source of truth), view state, diff-based updates
- **layers.store.ts**: UI layer selection (not map state)
- **featureSelection.store.ts**: Selected/hovered features, popup state

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
