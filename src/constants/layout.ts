/**
 * Layout grid dimensions for the viewer
 */
export const LAYOUT = {
  /** Width of the layer panel (left side) */
  LAYER_PANEL_WIDTH: 400,
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
 */
export const MAP_VIEW_PADDING: [number, number, number, number] = [
  LAYOUT.GRID_PADDING,
  0,
  LAYOUT.GRID_PADDING,
  LAYOUT.LAYER_PANEL_WIDTH + LAYOUT.GRID_PADDING,
]
