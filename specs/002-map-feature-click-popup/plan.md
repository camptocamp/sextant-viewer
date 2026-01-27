# Implementation Plan: Map Feature Click Popup

**Branch**: `002-map-feature-click-popup` | **Date**: 2026-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-map-feature-click-popup/spec.md`

## Summary

Add interactive feature selection to the map. When a user clicks on a vector layer feature, a popup appears showing the layer name, feature ID, and all attributes. Features highlight on hover with cursor change. URLs in attributes are clickable.

**Technical Approach**: Use OpenLayers Overlay for popup positioning with autopan, custom styled popup (UPopover not usable without trigger element), and a new Pinia store for selection state. Feature hit detection via `map.forEachFeatureAtPixel()`.

## Technical Context

**Language/Version**: TypeScript 5.9+ with Vue 3.5+ Composition API
**Primary Dependencies**: OpenLayers 10.7.0, @geospatial-sdk/core 0.0.5, @nuxt/ui 4.3.0, Pinia 3.0.4
**Storage**: N/A (runtime state only)
**Testing**: Vitest (when testing strategy defined)
**Target Platform**: Web browser (modern browsers)
**Project Type**: Single frontend application
**Performance Goals**: Popup display within 1 second of click, cursor update at 60fps
**Constraints**: Popup readable for up to 10 attributes without scrolling
**Scale/Scope**: Standard web map with multiple vector layers

## Constitution Check

*GATE: All principles validated. No violations.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MapContext as Source of Truth | ✅ | Selection state separate from MapContext (not map configuration) |
| II. Vue.js Best Practices | ✅ | `<script setup>`, Pinia Composition API |
| III. Clean Code & SOLID | ✅ | Single responsibility composables, clear naming |
| IV. Component Architecture | ✅ | FeaturePopup (container) + FeaturePopupContent (presentation) |
| V. TypeScript-First | ✅ | Strict typing with OpenLayers types |
| VI. Geospatial-SDK Integration | ✅ | Uses existing MapContext, layer utilities |
| VII. Software Craftsmanship | ✅ | ESLint/Prettier enforced |
| VIII. NuxtUI Component Library | ⚠️ | UPopover not usable (requires trigger element); custom styled popup with Tailwind CSS |
| IX. Minimal Comments Standard | ✅ | Self-documenting code, no task references |

## Project Structure

### Documentation (this feature)

```text
specs/002-map-feature-click-popup/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Technical decisions
├── data-model.md        # State and entity definitions
├── quickstart.md        # Implementation guide
├── contracts/           # Component interfaces
│   └── components.ts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (new files)

```text
src/
├── components/
│   └── map/
│       ├── FeaturePopup.vue           # Container: Overlay positioning
│       └── FeaturePopupContent.vue    # Presentation: Popup content
├── composables/
│   ├── useMapFeatureInteraction.ts    # Click/hover event handling
│   ├── useFeatureHighlight.ts         # Selection/hover styles
│   └── useFeatureInfo.ts              # Feature data extraction
├── stores/
│   └── featureSelection.store.ts      # Selection/hover state
└── utils/
    └── url.utils.ts                   # URL detection helper
```

### Source Code (modified files)

```text
src/
├── components/
│   └── map/
│       └── MapViewer.vue              # Add interaction + popup
└── utils/
    └── layer.utils.ts                 # Add getLayerName()
```

**Structure Decision**: Single frontend structure. New files follow existing conventions in `src/components/map/`, `src/composables/`, `src/stores/`.

## Implementation Phases

### Phase 1: State & Utilities

1. Create `featureSelection.store.ts` with selection/hover state
2. Add `getLayerName()` to `layer.utils.ts`
3. Create `url.utils.ts` with `extractUrls()` function
4. Create `useFeatureInfo.ts` composable

**Files**: 4 new, 1 modified

### Phase 2: Map Interactions

1. Create `useMapFeatureInteraction.ts` composable
   - Click handler with `forEachFeatureAtPixel()`
   - Pointer move handler with `hasFeatureAtPixel()`
   - Cursor style management
2. Create `useFeatureHighlight.ts` composable
   - OpenLayers Select interaction for selection style
   - Hover style via separate mechanism

**Files**: 2 new

### Phase 3: Popup Components

1. Create `FeaturePopupContent.vue`
   - Layer name header
   - Feature ID display
   - Attributes list with bold names
   - URL rendering with `target="_blank"`
   - Close button
2. Create `FeaturePopup.vue`
   - OpenLayers Overlay management
   - Custom styled popup with arrow (UPopover not usable without trigger)
   - Autopan configuration

**Files**: 2 new

### Phase 4: Integration

1. Modify `MapViewer.vue`
   - Provide map reference to children
   - Add interaction composables
   - Include FeaturePopup component
2. Verify highlight styles

**Files**: 1 modified

## Key Implementation Details

### OpenLayers Overlay + Custom Popup Integration

```typescript
// FeaturePopup.vue concept
const overlay = new Overlay({
  element: popupRef.value,
  autoPan: {
    animation: { duration: 250 },
  },
  positioning: 'bottom-center',
})
map.addOverlay(overlay)

// Position at click coordinate
watch(() => store.popupCoordinate, (coord) => {
  overlay.setPosition(coord ?? undefined)
})
```

### Feature Hit Detection

```typescript
// Only vector layers
map.forEachFeatureAtPixel(pixel, (feature, layer) => {
  if (layer instanceof VectorLayer) {
    return { feature, layer }
  }
}, { hitTolerance: 5 })
```

### URL Detection

```typescript
const URL_REGEX = /\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g

function extractUrls(value: string): string[] {
  return [...value.matchAll(URL_REGEX)].map(m => m[0])
}
```

## File Changes Summary

| File | Action | Lines (est.) |
|------|--------|--------------|
| `stores/featureSelection.store.ts` | Create | ~60 |
| `composables/useMapFeatureInteraction.ts` | Create | ~80 |
| `composables/useFeatureHighlight.ts` | Create | ~50 |
| `composables/useFeatureInfo.ts` | Create | ~40 |
| `utils/url.utils.ts` | Create | ~15 |
| `utils/layer.utils.ts` | Modify | +10 |
| `components/map/FeaturePopup.vue` | Create | ~80 |
| `components/map/FeaturePopupContent.vue` | Create | ~100 |
| `components/map/MapViewer.vue` | Modify | +20 |
| **Total** | 7 new, 2 modified | ~455 |

## Complexity Tracking

No constitution violations. All patterns follow established conventions.

## Testing Plan

### Manual Testing

1. Load map with WFS layer (bus lines from Lille)
2. Load map with GeoJSON layer (bike racks)
3. Click on features → verify popup content
4. Click outside → verify popup closes
5. Hover → verify cursor and highlight
6. Test URL clicking in attributes
7. Test autopan near viewport edges
8. Test feature without ID

### Future Automated Tests

- Unit: `useFeatureInfo` attribute extraction
- Unit: `extractUrls` URL detection
- Component: `FeaturePopupContent` rendering
- Integration: Click interaction flow

## Next Steps

Run `/speckit.tasks` to generate the task breakdown for implementation.
