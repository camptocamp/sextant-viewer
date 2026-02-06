import type { FlatStyleLike } from 'ol/style/flat'

/**
 * Hover style for all geometry types (yellow)
 */
export const FEATURE_HOVER_STYLE: FlatStyleLike = [
  {
    filter: ['==', ['geometry-type'], 'Point'],
    style: {
      'circle-fill-color': '#ffcc00',
      'circle-radius': 13,
      'circle-stroke-color': 'white',
      'circle-stroke-width': 3,
    },
  },
  {
    filter: ['==', ['geometry-type'], 'LineString'],
    style: [
      { 'stroke-color': 'white', 'stroke-width': 8 },
      { 'stroke-color': '#ffcc00', 'stroke-width': 5 },
    ],
  },
  {
    filter: ['==', ['geometry-type'], 'Polygon'],
    style: {
      'stroke-color': '#ffcc00',
      'stroke-width': 4,
      'fill-color': 'rgba(255, 204, 0, 0.3)',
    },
  },
]

/**
 * Selected style for all geometry types (green-yellow)
 */
export const FEATURE_SELECTED_STYLE: FlatStyleLike = [
  {
    filter: ['==', ['geometry-type'], 'Point'],
    style: {
      'circle-fill-color': '#ccff00',
      'circle-radius': 13,
      'circle-stroke-color': 'white',
      'circle-stroke-width': 3,
    },
  },
  {
    filter: ['==', ['geometry-type'], 'LineString'],
    style: [
      { 'stroke-color': 'white', 'stroke-width': 10 },
      { 'stroke-color': '#ccff00', 'stroke-width': 6 },
    ],
  },
  {
    filter: ['==', ['geometry-type'], 'Polygon'],
    style: {
      'stroke-color': '#ccff00',
      'stroke-width': 5,
      'fill-color': 'rgba(204, 255, 0, 0.3)',
    },
  },
]
