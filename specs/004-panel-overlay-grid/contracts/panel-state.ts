/**
 * Type definitions for Panel Overlay Grid System
 *
 * These interfaces define the contract between components and state management
 * for the dynamic panel grid feature.
 *
 * @see ../data-model.md for detailed documentation
 */

import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Panel type discriminator.
 * Determines which component to render for a panel slot.
 */
export type PanelType = 'layer-panel' | 'layer-details'

/**
 * Grid column count (1-5 panels).
 * Determines CSS Grid template columns configuration.
 */
export type GridColumnCount = 1 | 2 | 3 | 4 | 5

/**
 * CSS class name for grid layout.
 * Maps to Tailwind/custom CSS classes defining grid-template-columns.
 */
export type GridClass = 'grid-1-col' | 'grid-2-col' | 'grid-3-col' | 'grid-4-col' | 'grid-5-col'

/**
 * Layer selection state stored in Pinia.
 * Tracks which layer (if any) is currently selected by the user.
 */
export interface LayerSelectionState {
  /**
   * ID of the currently selected layer from MapContext.
   * Null when no layer is selected.
   */
  selectedLayerId: string | null

  /**
   * The full layer object for the selected layer.
   * Null when no layer is selected or layer not found.
   * This is a computed property derived from selectedLayerId.
   */
  selectedLayer: MapContextLayer | null
}

/**
 * Panel visibility state (derived/computed).
 * Determines which panels should be visible in the grid.
 */
export interface PanelVisibilityState {
  /**
   * Whether the layer details panel is visible.
   * True when a layer is selected.
   */
  isDetailsVisible: boolean

  /**
   * Number of active panels (1-5).
   * Currently: 1 (Layer Panel) or 2 (Layer Panel + Details Panel)
   * Future: up to 5 as new panel types are added
   */
  activePanelCount: GridColumnCount
}

/**
 * Configuration for a single panel in the grid.
 * Defines type, visibility, and props for rendering.
 */
export interface PanelConfig {
  /**
   * Unique identifier for this panel instance.
   * Used for keying in v-for loops and debugging.
   */
  id: string

  /**
   * Panel type discriminator.
   * Determines which component to render.
   */
  type: PanelType

  /**
   * Whether this panel is currently visible.
   * All panels in GridConfig.panels array should be visible.
   */
  visible: boolean

  /**
   * Props to pass to the panel component.
   * Type varies based on panel type.
   */
  props?: Record<string, unknown>
}

/**
 * Complete grid configuration.
 * Includes CSS class for layout and array of panel configurations.
 */
export interface GridConfig {
  /**
   * CSS class name for grid-template-columns configuration.
   * Maps to Tailwind/custom CSS classes defining column counts.
   */
  gridClass: GridClass

  /**
   * Array of panel configurations, one per visible panel.
   * Order determines grid column placement (left to right).
   */
  panels: PanelConfig[]
}

/**
 * Props for LayerPanel component.
 * Currently no props needed (uses composable for state).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LayerPanelProps {}

/**
 * Emits for LayerPanel component.
 */
export interface LayerPanelEmits {
  /**
   * Emitted when a layer is selected/clicked by the user.
   * @param layerId - The ID of the selected layer
   */
  selectLayer: [layerId: string]
}

/**
 * Props for LayerDetailsPanel component.
 */
export interface LayerDetailsPanelProps {
  /**
   * The layer to display details for.
   * Required prop, always provided when panel is visible.
   */
  layer: MapContextLayer
}

/**
 * Emits for LayerDetailsPanel component.
 */
export interface LayerDetailsPanelEmits {
  /**
   * Emitted when the close button is clicked.
   * Parent should call deselectLayer() in response.
   */
  close: []
}

/**
 * Emits for LayerManager component (modified existing component).
 */
export interface LayerManagerEmits {
  /**
   * Emitted when a layer item is clicked.
   * @param layer - The full layer object that was clicked
   */
  selectLayer: [layer: MapContextLayer]
}

/**
 * Return type of usePanelState composable.
 * Provides reactive panel state to components.
 */
export interface UsePanelStateReturn {
  /**
   * Whether the layer details panel should be visible.
   * Computed from selectedLayerId !== null.
   */
  isDetailsVisible: ComputedRef<boolean>

  /**
   * Number of panels currently active (1-5).
   * Computed from visible panel count.
   */
  activePanelCount: ComputedRef<GridColumnCount>

  /**
   * The currently selected layer, or null.
   * Computed from store state.
   */
  selectedLayer: ComputedRef<MapContextLayer | null>

  /**
   * Action: Select a layer by ID (or toggle if already selected).
   */
  selectLayer: (layerId: string) => void

  /**
   * Action: Deselect the current layer.
   */
  deselectLayer: () => void
}

/**
 * Import for Vue's ComputedRef type (used in UsePanelStateReturn).
 * This is a re-export for convenience.
 */
import type { ComputedRef } from 'vue'
