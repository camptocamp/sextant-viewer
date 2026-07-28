import {
  getDimensionDefaultValue,
  WmsEndpoint,
  type WmsLayerDimension,
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

export function getWmsTimeDimension(layer: MapLayer): WmsLayerDimension | null {
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

/**
 * Resolve the TIME value a layer should default to, as a Date.
 * Delegates the WMS semantics to ogc-client; returns null if unparseable.
 */
export function getDefaultWmsTime(dim: WmsLayerDimension): Date | null {
  const candidate = getDimensionDefaultValue(dim)
  if (!candidate) return null
  const d = new Date(candidate)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format a Date as ISO 8601 without milliseconds ("2026-06-24T03:00:00Z").
 * Some WMS servers (e.g. GeoMet) reject the ".000" that Date.toISOString() emits.
 * Stored as a string so the SDK forwards it verbatim rather than re-serializing.
 */
export function toWmsTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Drop the server-derived `extras.wmsDimensions` before persistence
 */
export function stripWmsDimensions(layer: MapLayer): MapLayer {
  if (layer.type !== 'wms' || !layer.extras?.wmsDimensions) return layer
  const { wmsDimensions: _wmsDimensions, ...extras } = layer.extras
  return { ...layer, extras }
}

/**
 * Enrich a WMS layer with the dimensions the server declares (TIME, ELEVATION, …).
 * Stores all dimensions in `extras.wmsDimensions`, then seeds `dimensionValues`
 * from each dimension's server default.
 * Returns the layer unchanged when it declares no dimensions
 */
export async function enrichWmsDimensionsLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.wmsDimensions) return layer

  try {
    const endpoint = new WmsEndpoint((layer as { url: string }).url)
    await endpoint.isReady()
    const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
    const dims = layerInfo?.dimensions ?? []
    if (dims.length === 0) return layer

    // WMS dimension names are case-insensitive; servers may emit TIME, Time, etc.
    const timeDim = dims.find((d) => d.name.toLowerCase() === 'time')

    const wmsLayer = layer as MapContextLayerWms
    const existing = wmsLayer.dimensionValues ?? {}
    const seeded: NonNullable<MapContextLayerWms['dimensionValues']> = { ...existing }
    for (const dim of dims) {
      const key = dim.name.toUpperCase()
      // Preserve a consumer-provided value as-is.
      if (seeded[key]) continue
      if (dim === timeDim) {
        const defaultTime = getDefaultWmsTime(dim)
        if (defaultTime) seeded[key] = toWmsTime(defaultTime)
      } else {
        const def = getDimensionDefaultValue(dim)
        if (def) seeded[key] = String(def)
      }
    }

    return {
      ...layer,
      extras: {
        ...layer.extras,
        wmsDimensions: dims,
      },
      ...(Object.keys(seeded).length > 0 && { dimensionValues: seeded }),
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

const escapeLikeValue = (value: string) => value.replace(/[*.!]/g, (c) => `${ESCAPE_CHAR}${c}`)

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
export function buildOgcFilter(filter: WmsFilterState): Filter | null {
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
