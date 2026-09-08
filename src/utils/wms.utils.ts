import type { WmsLayerDimension, WmsLayerTimeDimension } from '@camptocamp/ogc-client'
import { and, equalTo, like, or } from 'ol/format/filter'
import { writeFilter } from 'ol/format/WFS'
import type Filter from 'ol/format/filter/Filter'
import type { FilterByAttribute, WmsFilterState } from '@/types/wms.types'
import type { MapLayer } from './layer.utils'

/** Split a (possibly comma-joined) WMS layer name into its trimmed, non-empty sublayers. */
export function splitSublayers(layerName: string): string[] {
  return layerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

/**
 * Get the default value from a WMS dimension (time or other).
 * Returns the declared default, or falls back to the first available value.
 */
export function getDefaultValue(
  dim: WmsLayerTimeDimension | WmsLayerDimension,
): Date | string | number | null {
  if (dim.defaultValue !== undefined) return dim.defaultValue
  const values = dim.values
  if (values && typeof values === 'object' && !Array.isArray(values) && 'begin' in values) {
    return values.begin
  }
  if (Array.isArray(values) && values.length > 0) {
    const first = values[0]
    if (first && typeof first === 'object' && 'begin' in first) return first.begin
    return first ?? null
  }
  return null
}

/**
 * Drop the server-derived extras (`dataIndex`, `wpsProcesses`) before persistence.
 */
export function stripDerivedExtras(layer: MapLayer): MapLayer {
  if (layer.type !== 'wms' || !layer.extras) return layer
  const { dataIndex, wpsProcesses } = layer.extras
  if (!dataIndex && !wpsProcesses) return layer
  const { dataIndex: _dataIndex, wpsProcesses: _wpsProcesses, ...extras } = layer.extras
  return { ...layer, extras }
}

// WMS version used to write the OGC Filter.
// Version pinned to 1.1.0 to preserve QGIS Server compatibility (2.0.0 would emit the fes/ValueReference form).
const FILTER_VERSION = '1.1.0'

// PropertyIsLike special characters; literal occurrences in values are escaped with ESCAPE_CHAR.
const WILD_CARD = '*'
const SINGLE_CHAR = '.'
const ESCAPE_CHAR = '!'

const escapeLikeValue = (value: string) => value.replaceAll(/[*.!]/g, (c) => `${ESCAPE_CHAR}${c}`)

function buildComparison(attribute: FilterByAttribute, value: string): Filter | null {
  switch (attribute.matchType) {
    case 'equals':
      return equalTo(attribute.attributeName, value)
    case 'contains':
      // Tokenized column: the raw WFS value is the separator-joined token string, match by substring.
      return like(
        attribute.attributeName,
        `${WILD_CARD}${escapeLikeValue(value)}${WILD_CARD}`,
        WILD_CARD,
        SINGLE_CHAR,
        ESCAPE_CHAR,
      )
    default:
      // Unknown match types (stale persisted state, consumer contexts) must not break the render.
      console.error(`Type de filtre attributaire non supporté: ${attribute.matchType}`)
      return null
  }
}

function buildFieldGroup(attribute: FilterByAttribute, values: string[]): Filter | null {
  const comparisons = values
    .map((value) => buildComparison(attribute, value))
    .filter((comparison): comparison is Filter => comparison !== null)
  if (comparisons.length === 0) return null
  return comparisons.length > 1 ? or(...comparisons) : comparisons[0]!
}

/**
 * Build an OL Filter from a WMS filter state.
 * Returns `null` if the filter state is empty (or holds no usable clause).
 */
function buildOgcFilter(filter: WmsFilterState): Filter | null {
  const groups: Filter[] = []
  for (const attribute of filter) {
    const values = attribute.values.filter((value) => value != null && value !== '')
    const group = values.length > 0 ? buildFieldGroup(attribute, values) : null
    if (group) groups.push(group)
  }

  if (groups.length === 0) return null

  return groups.length === 1 ? groups[0]! : and(...groups)
}

/** Serialise an OGC Filter to its `<Filter>…</Filter>` XML string. */
function serializeFilter(filter: Filter): string {
  return new XMLSerializer().serializeToString(writeFilter(filter, FILTER_VERSION))
}

/**
 * The layer's active selections, keyed by column (`esField` / `attributeName`) — the shape both the
 * filter UI and the WPS profile address them by (`linkedWfsFilter` names the same column).
 */
export function activeFiltersOf(layer: MapLayer): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const filter = (layer.type === 'wms' && (layer.extras?.filter as WmsFilterState)) || []
  for (const { attributeName, values } of filter) out[attributeName] = values
  return out
}

/**
 * Build the WMS `FILTER` GetMap parameter value for a layer.
 */
export function buildWmsFilterParam(layerName: string, filter: WmsFilterState): string | null {
  const ogcFilter = buildOgcFilter(filter)
  if (!ogcFilter) return null

  const wrapped = serializeFilter(ogcFilter)
  // WMS wants one parenthesised group per sublayer when the layer is comma-joined.
  const count = splitSublayers(layerName).length
  return count > 1 ? `(${wrapped})`.repeat(count) : wrapped
}
