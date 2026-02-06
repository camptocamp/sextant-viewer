/**
 * Component Contracts: Map Feature Click Popup
 * 
 * These interfaces define the props and emits for new components.
 * Implementation must match these contracts.
 */

import type { Feature } from 'ol'
import type BaseLayer from 'ol/layer/Base'
import type { Coordinate } from 'ol/coordinate'

// ============================================================================
// FeaturePopup.vue
// ============================================================================

/**
 * Container component that manages OpenLayers Overlay positioning.
 * Renders popup at map coordinates when a feature is selected.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeaturePopupProps {
  /** OpenLayers map reference */
  // Injected via provide/inject from MapViewer
}

export interface FeaturePopupEmits {
  /** Emitted when popup is closed */
  (event: 'close'): void
}

// No props - uses Pinia store for state

// ============================================================================
// FeaturePopupContent.vue
// ============================================================================

/**
 * Presentational component for popup content.
 * Displays layer name, feature ID, and attributes.
 */
export interface FeaturePopupContentProps {
  /** Name of the layer containing the feature */
  layerName: string
  
  /** Feature identifier (e.g., "Objet #1234") */
  featureId: string
  
  /** Feature attributes to display */
  attributes: FeatureAttributeDisplay[]
}

export interface FeaturePopupContentEmits {
  /** Emitted when close button is clicked */
  (event: 'close'): void
}

// ============================================================================
// FeatureAttributeRow.vue (optional - can be inline)
// ============================================================================

/**
 * Single attribute row with optional URL linking.
 */
export interface FeatureAttributeDisplay {
  /** Attribute name (displayed in bold) */
  name: string
  
  /** Raw display value */
  value: string
  
  /** URLs extracted from value (HTTP/HTTPS only) */
  urls: string[]
}

// ============================================================================
// Composable Contracts
// ============================================================================

/**
 * useMapFeatureInteraction
 * 
 * Manages click and hover interactions on map features.
 */
export interface UseMapFeatureInteractionOptions {
  /** Callback when feature is clicked */
  onFeatureClick?: (feature: Feature, layer: BaseLayer, coordinate: Coordinate) => void
  
  /** Callback when feature is hovered */
  onFeatureHover?: (feature: Feature | null, layer: BaseLayer | null) => void
}

export interface UseMapFeatureInteractionReturn {
  /** Start listening to map events */
  activate: () => void
  
  /** Stop listening to map events */
  deactivate: () => void
  
  /** Cleanup function for component unmount */
  cleanup: () => void
}

/**
 * useFeatureHighlight
 * 
 * Manages visual highlighting of hovered and selected features.
 */
export interface UseFeatureHighlightReturn {
  /** Set the hovered feature (applies hover style) */
  setHoveredFeature: (feature: Feature | null) => void
  
  /** Set the selected feature (applies selection style) */
  setSelectedFeature: (feature: Feature | null) => void
  
  /** Clear all highlights */
  clearHighlights: () => void
  
  /** Cleanup function */
  cleanup: () => void
}

/**
 * useFeatureInfo
 * 
 * Extracts display information from OpenLayers feature.
 */
export interface UseFeatureInfoReturn {
  /** Extract feature info for popup display */
  extractFeatureInfo: (
    feature: Feature,
    layer: BaseLayer
  ) => {
    layerName: string
    featureId: string
    attributes: FeatureAttributeDisplay[]
  }
}
