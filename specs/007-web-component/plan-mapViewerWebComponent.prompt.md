# Plan: Convert MapViewer to Web Component

Convert the existing `MapViewer.vue` component into a standalone Web Component using Vue 3's `defineCustomElement`, configure Vite for library build mode, and update `index.html` to use the custom element.

## Steps

1. **Create Web Component wrapper** at `src/web-component.ts` that uses `defineCustomElement`, creates an internal Pinia instance with `useMapStore`, wraps `MapViewer.vue`, and registers the custom element as `<map-viewer>`.

2. **Modify `index.html`** to use `<map-viewer>` custom element, remove Vue app mounting logic, and include the built Web Component script from `dist/`.

3. **Update `vite.config.ts`** to use library build mode with entry point at `index.html`, output to `dist/map-viewer.js`, bundle all dependencies (OpenLayers, geospatial-sdk, Pinia), and inline all CSS (including `ol/ol.css` and Tailwind utilities).

## Implementation Decisions

1. **State management approach**: Continue using Pinia for MapContext management. The Web Component will embed a Pinia store instance internally. Props can be added in a second phase if needed.

2. **Dependency bundling**: Bundle all necessary dependencies (OpenLayers, geospatial-sdk) into the Web Component for a self-contained distributable.

3. **CSS strategy**: Inline all CSS (including `ol/ol.css` and Tailwind utilities) into the Web Component bundle for simplified usage.
