/**
 * Layout grid dimensions for the viewer
 * Used by LayoutGrid.vue and FeaturePopup.vue for consistent spacing
 */
export const LAYOUT = {
  /** Width of the layer panel (left side) */
  LAYER_PANEL_WIDTH: 400,
  /** Width of the reserved middle panel */
  MIDDLE_PANEL_WIDTH: 440,
  /** Minimum width of the map area */
  MAP_MIN_WIDTH: 900,
  /** Width of the reserved right panel */
  RIGHT_PANEL_WIDTH: 200,
  /** Gap between grid cells */
  GRID_GAP: 8,
  /** Padding around the grid */
  GRID_PADDING: 8,
} as const

/**
 * Feature popup configuration
 */
export const FEATURE_POPUP = {
  /** Base margin for autoPan (added to panel widths) */
  BASE_MARGIN: 50,
  /** Animation duration for autoPan in ms */
  AUTO_PAN_DURATION: 250,
  /** Vertical offset from feature */
  VERTICAL_OFFSET: -10,
} as const

/**
 * Map view padding to account for overlay panels
 * Format: [top, right, bottom, left] in pixels
 * This tells OpenLayers that part of the viewport is "reserved" for UI panels
 */
export const MAP_VIEW_PADDING: [number, number, number, number] = [
  LAYOUT.GRID_PADDING, // top
  0, // right (no panel currently visible)
  LAYOUT.GRID_PADDING, // bottom
  LAYOUT.LAYER_PANEL_WIDTH + LAYOUT.GRID_PADDING, // left (LayerPanel)
]
