# Research: Map Feature Click Popup

**Feature**: 002-map-feature-click-popup
**Date**: 2026-01-26

## Technical Decisions

### 1. Popup Positioning Strategy

**Decision**: Use NuxtUI UPopover with an invisible trigger element positioned at pixel coordinates

**Rationale**:
- Consistent styling with NuxtUI design system
- Native Vue component with proper reactivity
- Automatic positioning via Floating UI

**Implementation Pattern**:
1. Create a 1px invisible trigger div positioned at the click pixel coordinates
2. Use `v-model:open` to control popover visibility from the store
3. Listen to map `moveend` and `postrender` events to update trigger position during pan/zoom
4. Implement custom autopan logic since UPopover doesn't have built-in map awareness

```typescript
const triggerStyle = ref({ left: '0px', top: '0px' })

function updateTriggerPosition() {
  const pixel = map.getPixelFromCoordinate(store.popupCoordinate)
  if (pixel) {
    triggerStyle.value = { left: `${pixel[0]}px`, top: `${pixel[1]}px` }
  }
}

// Listen to map events
map.on('moveend', updateTriggerPosition)
map.on('postrender', updateTriggerPosition)
```

**Autopan Implementation**:
Custom logic calculates if the popup would be outside the visible map area and animates the view center accordingly:

```typescript
if (pixelY < margin) {
  newCenter[1] += (margin - pixelY) * resolution
  needsPan = true
}
// Similar checks for left/right edges
if (needsPan) {
  view.animate({ center: newCenter, duration: 250 })
}
```

**Alternatives Considered**:
1. **OpenLayers Overlay**: Tested but required custom Tailwind styling; UPopover provides better design system integration
2. **Pure CSS positioning**: Rejected - would not track map pan/zoom properly
3. **OpenLayers built-in Popup**: Rejected - no styling consistency with NuxtUI

### 2. Feature Hit Detection

**Decision**: Use OpenLayers `map.forEachFeatureAtPixel()` for click detection and `map.hasFeatureAtPixel()` for hover cursor

**Rationale**:
- Native OpenLayers API with optimized spatial indexing
- Returns topmost feature first (fulfills edge case requirement)
- Works with all vector layer types (WFS, GeoJSON, OGC API)
- Supports layer filtering to exclude raster/non-vector layers

**Implementation Pattern**:
```typescript
map.on('singleclick', (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
    if (isVectorLayer(layer)) return { feature, layer }
  })
})
```

### 3. State Management

**Decision**: Create a new Pinia store `useFeatureSelectionStore` for selection/hover state

**Rationale**:
- Separation of concerns from `useMapStore` (map context) and `useLayersStore` (layer panel selection)
- Reactive state enables component reactivity without prop drilling
- Centralized location for feature selection logic

**State Shape**:
```typescript
{
  selectedFeature: Feature | null
  selectedLayer: Layer | null
  hoveredFeature: Feature | null
  popupPosition: Coordinate | null
}
```

### 4. Highlight Styling

**Decision**: Use OpenLayers Select interaction with custom style function

**Rationale**:
- Native OpenLayers pattern for selection/highlight styling
- Style function allows different highlight colors for hover vs selection
- Automatically handles style application and cleanup

**Alternatives Considered**:
1. **Modify feature style directly**: Rejected - would need to track and restore original styles
2. **Overlay layer for highlights**: Rejected - adds complexity, Select interaction is simpler

### 5. URL Detection in Attributes

**Decision**: Use provided regex pattern with `String.prototype.matchAll()` for URL extraction

**Regex Pattern**: `/\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g`

**Rationale**:
- Matches HTTP/HTTPS URLs only (excludes file://, ftp:// as required)
- Handles URLs with parentheses (common in Wikipedia links)
- Global flag allows multiple URLs per attribute value

**Implementation**:
```typescript
function extractUrls(value: string): string[] {
  const regex = /\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g
  return [...value.matchAll(regex)].map(match => match[0])
}
```

### 6. Layer Name Resolution

**Decision**: Extend `layer.utils.ts` with `getLayerName()` function

**Rationale**:
- Existing `getLayerLabel()` already provides display names
- MapContextLayer contains `name`, `title`, `label`, or `id` fields
- Centralized utility maintains consistency with existing pattern

**Resolution Order**:
1. `layer.title` (user-friendly name)
2. `layer.name` (service name)
3. `layer.label` (display label - used by geospatial-sdk layers)
4. `layer.id` (fallback identifier)

**Implementation Note**: Use `layer.getProperties()` to access all properties at once. Layers created by geospatial-sdk primarily use the `label` property for display names.

### 7. Feature ID Resolution

**Decision**: Check `feature.getId()` then `feature.get('id')` or `feature.get('fid')`

**Rationale**:
- OpenLayers features may have ID set via `setId()` or as property
- WFS features typically use `fid` property
- GeoJSON features may use `id` property
- Fallback to "Objet sans identifiant" if none found

### 8. Popup Close Behavior

**Decision**: Close on close button click or click outside feature, with style restoration

**Rationale**:
- Close button emits event to clear store selection via `clearSelection()`
- Map click outside features triggers store reset via `clearSelection()`
- Feature must return to non-selected visual state when deselected

**Implementation Pattern**:
The `useMapFeatureInteraction` composable stores the previously selected feature and its original style. A Vue `watch` on `store.selectedFeature` detects when the selection is cleared (either by close button or clicking elsewhere) and restores the feature's original style:

```typescript
watch(
  () => store.selectedFeature,
  (newFeature) => {
    if (newFeature === null) {
      restoreSelectedFeatureStyle()
    }
  },
)
```

This approach centralizes style restoration logic and ensures consistent behavior regardless of how the popup is closed.

### 9. Component Architecture

**Decision**: Create `FeaturePopup.vue` container component with `FeaturePopupContent.vue` presentational child

**Rationale**:
- Separation of concerns (positioning vs content rendering)
- FeaturePopup handles UPopover positioning and map event listeners
- FeaturePopupContent handles attribute display, URL rendering
- Follows Constitution IV (Component Architecture)

### 10. Cursor Change Implementation

**Decision**: Use `map.getTargetElement().style.cursor` on pointermove event

**Rationale**:
- Direct DOM manipulation for cursor is standard OpenLayers pattern
- `hasFeatureAtPixel()` provides efficient hit testing without full feature lookup
- Pointer cursor indicates clickable elements per web conventions

## Dependencies Verified

| Dependency | Version | Usage |
|------------|---------|-------|
| OpenLayers | 10.7.0 | Map, Overlay, Select, events |
| @geospatial-sdk/core | 0.0.5-dev.49 | MapContext, layer types |
| @geospatial-sdk/openlayers | 0.0.5-dev.49 | Map creation, utilities |
| @nuxt/ui | 4.3.0 | UButton (close button), design tokens |
| Pinia | 3.0.4 | State management |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| UPopover position lag during rapid pan/zoom | Listen to both `moveend` and `postrender` events for smooth updates |
| Large attribute counts may overflow popup | Add max-height with scroll (SC-003: up to 10 attributes readable) |
| Multiple overlapping features at click point | forEachFeatureAtPixel returns topmost by default |
| Performance on dense vector layers | Use `hasFeatureAtPixel` for hover (cheaper than full lookup) |

## Open Questions

None - all technical decisions resolved.
