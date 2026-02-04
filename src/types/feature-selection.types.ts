import type { Feature } from 'geojson'

export interface FeatureAttribute {
  name: string
  value: unknown
  displayValue: string
  urls: string[]
}

export interface FeatureInfo {
  layerName: string
  featureId: string
  attributes: FeatureAttribute[]
}

export interface SelectedFeatureState {
  selectedFeature: Feature | null
  selectedLayerIndex: number | null
  popupCoordinate: [number, number] | null
}
