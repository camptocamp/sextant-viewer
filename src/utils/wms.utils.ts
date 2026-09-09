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

export type AnyWmsDimension = WmsLayerDimension | WmsLayerTimeDimension

/** Split a (possibly comma-joined) WMS layer name into its trimmed, non-empty sublayers. */
export function splitSublayers(layerName: string): string[] {
  return layerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

// WMS dimension names are case-insensitive; ogc-client classifies them case-sensitively,
// so a server emitting "TIME" lands in `otherDimensions`. Re-derive the classification here.
const isTimeName = (name: string) => name.toLowerCase() === 'time'
export const isElevationName = (name: string) => name.toLowerCase() === 'elevation'

const isTemporal = (dim: AnyWmsDimension): dim is WmsLayerTimeDimension => 'isTime' in dim

function getWmsDimensions(layer: MapLayer): AnyWmsDimension[] {
  if (layer.type !== 'wms') return []
  return (layer.extras?.wmsDimensions as AnyWmsDimension[]) ?? []
}

/** The `time` dimension, only when the server also declares it as temporal. */
export function getWmsTimeDimension(layer: MapLayer): WmsLayerTimeDimension | null {
  const dim = getWmsDimensions(layer).find((d) => isTimeName(d.name))
  return dim && isTemporal(dim) ? dim : null
}

/**
 * Every dimension but the temporal `time` one (elevation, band, …). A dimension named `time` that
 * the server does not declare as temporal is dropped rather than emitted as `DIM_TIME`.
 */
export function getWmsOtherDimensions(layer: MapLayer): AnyWmsDimension[] {
  return getWmsDimensions(layer).filter((d) => !isTimeName(d.name))
}

// `values` is typed non-nullable but arrives null from `getDimensionsWithNewExtent`, the WMS 1.1.x
// `<Extent>` inheritance path, which only filters out null dimensions. Reading it in a computed
// makes an unguarded access take down the whole details panel.
const listValues = (dim: AnyWmsDimension): unknown[] => {
  const values: unknown = dim.values
  if (values == null) return []
  return Array.isArray(values) ? values : [values]
}

const isInterval = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'begin' in value

/**
 * A temporal dimension's dates are Date objects on the first parse only: ogc-client's cache
 * round-trips its capabilities through JSON (`shared/cache.js` stringifies on store and parses on
 * read), so every later read hands back ISO strings under the very same `Date` type. Coerce rather
 * than test with `instanceof`, or a layer whose service was already cached loses its dimension.
 */
export function toDimensionDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Format a Date as ISO 8601 without the zero milliseconds ("2026-06-24T03:00:00Z"). The SDK forwards
 * the string verbatim, and two public servers reject the ".000Z" that toISOString() always appends:
 * NASA GIBS answers HTTP 400, Environment Canada's GeoMet a `NoMatch` ServiceException. A genuine
 * sub-second value is left alone rather than truncated.
 */
export function toWmsTime(date: Date): string {
  return date.toISOString().replace(/\.000Z$/, 'Z')
}

/**
 * A temporal value is formatted as a WMS time string: it is both displayed and sent verbatim as the
 * GetMap parameter, and Date.toString() is not a valid WMS value.
 */
const toOption = (value: unknown): string | null => {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : toWmsTime(value)
  if (value == null || isInterval(value)) return null
  return String(value)
}

/** Enumerable values as strings. An interval is not enumerable and yields none. */
export function getDimensionOptions(dim: AnyWmsDimension): string[] {
  return listValues(dim)
    .map(toOption)
    .filter((option): option is string => option !== null)
}

/** Declared default, falling back to the first enumerable value. */
export function getDimensionDefaultOption(dim: AnyWmsDimension): string | undefined {
  // `!= null` rather than truthiness: an elevation `default="0"` is a valid default.
  if (dim.defaultValue != null) {
    const option = toOption(dim.defaultValue)
    if (option !== null) return option
  }
  return getDimensionOptions(dim)[0]
}

/** Declared default, else the first date, else the interval start. */
export function getDefaultWmsTime(dim: WmsLayerTimeDimension): Date | null {
  const declared = toDimensionDate(dim.defaultValue)
  if (declared) return declared

  for (const value of listValues(dim)) {
    const date =
      toDimensionDate(value) ??
      (isInterval(value) ? toDimensionDate((value as { begin: unknown }).begin) : null)
    if (date) return date
  }
  return null
}

/** Label for a dimension's unit; temporal dimensions declare none. */
export function getDimensionUnitLabel(dim: AnyWmsDimension): string | undefined {
  if (isTemporal(dim)) return undefined
  return dim.unitSymbol || dim.units || undefined
}

/**
 * Drop the server-derived extras (`wmsDimensions`, `dataIndex`, `wpsProcesses`) before persistence
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
 * Stores every dimension in a flat `extras.wmsDimensions`, then seeds `timeValue`,
 * `elevationValue` and `otherDimensionValues` from each dimension's server default,
 * preserving whatever the consumer already provided.
 * Returns the layer unchanged when it declares no dimensions.
 */
export async function enrichWmsDimensionsLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.wmsDimensions) return layer

  try {
    const endpoint = new WmsEndpoint((layer as { url: string }).url)
    await endpoint.isReady()
    const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
    if (!layerInfo) return layer

    const dims: AnyWmsDimension[] = [
      layerInfo.timeDimension,
      layerInfo.elevationDimension,
      ...(layerInfo.otherDimensions ?? []),
    ].filter((dim): dim is AnyWmsDimension => !!dim)
    if (dims.length === 0) return layer

    const wmsLayer = layer as MapContextLayerWms
    const seeded: Partial<MapContextLayerWms> = {}
    const otherValues = { ...wmsLayer.otherDimensionValues }

    for (const dim of dims) {
      if (isTimeName(dim.name)) {
        if (wmsLayer.timeValue === undefined && isTemporal(dim)) {
          const defaultTime = getDefaultWmsTime(dim)
          if (defaultTime) seeded.timeValue = toWmsTime(defaultTime)
        }
      } else if (isElevationName(dim.name)) {
        if (wmsLayer.elevationValue === undefined) {
          const def = getDimensionDefaultOption(dim)
          if (def !== undefined) seeded.elevationValue = def
        }
      } else if (otherValues[dim.name] === undefined) {
        // The server's own casing: the SDK upper-cases it to build DIM_<NAME>.
        const def = getDimensionDefaultOption(dim)
        if (def !== undefined) otherValues[dim.name] = def
      }
    }

    if (Object.keys(otherValues).length > 0) seeded.otherDimensionValues = otherValues

    return {
      ...layer,
      ...seeded,
      extras: {
        ...layer.extras,
        wmsDimensions: dims,
      },
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
