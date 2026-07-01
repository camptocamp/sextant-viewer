import {
  getDimensionDefaultValue,
  WmsEndpoint,
  type WmsLayerDimension,
} from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import type { FilterByAttribute, WmsFilterState } from '@/types/wms.types'
import type { MapLayer } from './layer.utils'

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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildComparison(attribute: FilterByAttribute, value: string): string {
  const property = xmlEscape(attribute.attributeName)
  switch (attribute.matchType) {
    case 'equals':
      return (
        `<PropertyIsEqualTo><PropertyName>${property}</PropertyName>` +
        `<Literal>${xmlEscape(value)}</Literal></PropertyIsEqualTo>`
      )
    // ponytail: 'contains' → PropertyIsLike, add when a tokenized field becomes filterable
    default:
      throw new Error(`Unsupported matchType: ${attribute.matchType}`)
  }
}

function buildFieldGroup(attribute: FilterByAttribute, values: string[]): string {
  const comparisons = values.map((value) => buildComparison(attribute, value)).join('')
  return values.length > 1 ? `<Or>${comparisons}</Or>` : comparisons
}

/**
 * Build the inner body of an OGC Filter from the active selections: each attribute's
 * selected values are OR-ed together, and the attributes are AND-ed. Returns `null`
 * when no attribute has a selected value.
 */
export function buildFilterBody(filter: WmsFilterState): string | null {
  const groups: string[] = []
  for (const attribute of filter) {
    const values = attribute.values.filter((value) => value != null && value !== '')
    if (values.length > 0) {
      groups.push(buildFieldGroup(attribute, values))
    }
  }
  if (groups.length === 0) return null
  const joined = groups.join('')
  return groups.length === 1 ? joined : `<And>${joined}</And>`
}

/**
 * Build the WMS `FILTER` GetMap parameter value for a (possibly multi-sublayer)
 * layer. QGIS Server expects one parenthesised `<Filter>` group per sublayer when
 * `LAYERS` holds several comma-separated names. Returns `null` when there is no
 * active filter.
 */
export function buildWmsFilterParam(layerName: string, filter: WmsFilterState): string | null {
  const body = buildFilterBody(filter)
  if (!body) return null
  const wrapped = `<Filter>${body}</Filter>`
  const sublayers = layerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return sublayers.length > 1 ? sublayers.map(() => `(${wrapped})`).join('') : wrapped
}
