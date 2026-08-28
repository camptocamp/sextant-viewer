import {
  WmsEndpoint,
  type WmsLayerDimension,
  type WmsLayerTimeDimension,
} from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
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

export function getWmsTimeDimension(layer: MapLayer): WmsLayerTimeDimension | null {
  if (layer.type !== 'wms') return null
  const dims = (layer.extras?.wmsDimensions as WmsLayerDimension[]) ?? []
  return dims.find((d) => d.name.toLowerCase() === 'time') ?? null
}

/** Non-time dimensions declared by the server (elevation, band, …). */
export function getWmsOtherDimensions(layer: MapLayer): WmsLayerDimension[] {
  if (layer.type !== 'wms') return []
  const dims = (layer.extras?.wmsDimensions as WmsLayerDimension[]) ?? []
  return dims.filter((d) => d.name.toLowerCase() !== 'time')
}

export function getDefaultTimeDimensionValue(dim: WmsLayerTimeDimension): Date | null {
  let candidate = dim.defaultValue
  if (!candidate && 'begin' in dim.values) {
    candidate = dim.values.begin
  }
  if (!candidate && Array.isArray(dim.values) && dim.values.length > 0) {
    if ('begin' in dim.values[0]!) {
      candidate = dim.values[0].begin
    } else {
      candidate = dim.values[0]
    }
  }
  if (!candidate) {
    return null
  }
  return isNaN(candidate.getTime()) ? null : candidate
}

export function getDefaultDimensionValue(dim: WmsLayerDimension): string | number | null {
  let candidate = dim.defaultValue
  if (!candidate && 'begin' in dim.values) {
    candidate = dim.values.begin
  }
  if (!candidate && Array.isArray(dim.values) && dim.values.length > 0) {
    if (dim.values[0] instanceof Object && 'begin' in dim.values[0]!) {
      candidate = dim.values[0].begin
    } else {
      candidate = dim.values[0]
    }
  }
  return candidate ?? null
}

/**
 * Drop the server-derived extras (`wmsDimensions`, `dataIndex`, `wpsProcesses`) before persistence
 * FIXME: this should not be required
 */
export function stripDerivedExtras(layer: MapLayer): MapLayer {
  if (layer.type !== 'wms' || !layer.extras) return layer
  const { wmsDimensions, dataIndex, wpsProcesses } = layer.extras
  if (!wmsDimensions && !dataIndex && !wpsProcesses) return layer
  const {
    wmsDimensions: _wmsDimensions,
    dataIndex: _dataIndex,
    wpsProcesses: _wpsProcesses,
    ...extras
  } = layer.extras
  return { ...layer, extras }
}

/**
 * Enrich a WMS layer with the dimensions the server declares (TIME, ELEVATION, …).
 * Stores all dimensions in `extras.wmsDimensions`, then seeds `dimensionValues`
 * from each dimension's server default.
 * Returns the layer unchanged when it declares no dimensions
 * FIXME: do not store dimension data on the layer!! also handle other dimensions than time and elev
 */
export async function enrichWmsDimensionsLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.wmsDimensions) return layer

  try {
    const endpoint = new WmsEndpoint((layer as { url: string }).url)
    await endpoint.isReady()
    const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
    if (!layerInfo.timeDimension && !layerInfo.elevationDimension) return layer

    const wmsLayer = layer as MapContextLayerWms
    const dimensions: MapContextLayerWms['dimensionValues'] = wmsLayer.dimensionValues
      ? { ...wmsLayer.dimensionValues }
      : {}

    if (layerInfo.timeDimension && dimensions['TIME'] === undefined) {
      const time = getDefaultTimeDimensionValue(layerInfo.timeDimension)
      if (time) {
        dimensions['TIME'] = time
      }
    }
    if (layerInfo.elevationDimension && dimensions['ELEVATION'] === undefined) {
      const elevation = getDefaultDimensionValue(layerInfo.elevationDimension)
      if (elevation) {
        dimensions['ELEVATION'] = elevation
      }
    }

    return {
      ...layer,
      extras: {
        ...layer.extras,
        wmsDimensions: {
          time: layerInfo.timeDimension,
          elevation: layerInfo.elevationDimension,
        },
      },
      ...(Object.keys(dimensions).length > 0 && { dimensionValues: dimensions }),
    }
  } catch (err) {
    console.error('WMS dimension enrichment failed', err)
    return layer
  }
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
  // `layer.type` and a cast rather than `isWmsLayer`: layer.utils imports this module, so importing
  // a value back from it would close a runtime cycle (same reason as `getWmsTimeDimension` above).
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
