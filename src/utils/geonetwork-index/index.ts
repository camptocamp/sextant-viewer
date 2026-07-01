import { WmsEndpoint } from '@camptocamp/ogc-client'
export { discoverFields, buildFieldFilter, fetchFieldValues, fetchCount } from './attributeIndex'
export type { IndexField, FieldValue, DistinctFieldValues } from './attributeIndex.types'
export { buildOgcFilter, buildWmsFilterParam } from './wms.utils'
export { fetchWfsResource } from './gnRecord'

import { fetchCount } from './attributeIndex'
import { fetchWfsResource, type GnProfile } from './gnRecord'
import { buildWmsFilterParam } from './wms.utils'
import type { IndexField } from './attributeIndex.types'
import type { MapLayer } from '../layer.utils'
import type { DataSource } from '@/types/data-source.types'
import type { ExtendedMapLayerWms, GeoNetworkIndexConnection } from '@/types/wms.types'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * For a WMS layer, encode its active selections (`extras.filter`) as the SDK `filter` (an OGC
 * FILTER applied at GetMap) and strip the app-only `extras` before handing the layer to the SDK.
 * Other layers pass through unchanged.
 */
export function applyWmsFilter(layer: MapContextLayer): MapContextLayer {
  if (layer.type !== 'wms') return layer
  const wmsExtras = layer.extras as ExtendedMapLayerWms['extras']
  const filter = buildWmsFilterParam(layer.name, wmsExtras?.filter ?? []) ?? undefined
  const extras = { ...layer.extras }
  delete extras.filter
  delete extras.dataIndex
  return { ...layer, filter, extras }
}

/**
 * Detect whether a WMS layer is filterable and resolve its ES index + filterable columns.
 *
 * A layer's Geonetwork metadata may live on one GeoNetwork while its features are indexed on
 * another, so the two are resolved independently by scanning the context `dataSources`:
 *   1. WMS `GetCapabilities` → the layer's `MetadataURL` → record UUID;
 *   2. metadata scan: the first dataSource whose GN base returns a record with an `OGC:WFS`
 *      `applicationProfile` → WFS url + filterable columns;
 *   3. index scan: the first dataSource whose ES index holds the layer's `featureTypeId`.
 *
 * Returns `null` when the layer has no such profile or is not indexed on any dataSource.
 */
async function detectAttributeFilter(
  layer: MapLayer,
  dataSources: DataSource[],
): Promise<GeoNetworkIndexConnection | null> {
  if (layer.type !== 'wms' || !layer.url || !layer.name) return null
  const sources = dataSources.filter((ds) => ds.type === 'geonetwork-index')
  if (sources.length === 0) return null

  const endpoint = await new WmsEndpoint(layer.url).isReady()
  const uuid = metadataUuid(endpoint, layer.name)
  if (!uuid) return null

  let record: { wfsUrl: string; profile: GnProfile } | null = null
  for (const ds of sources) {
    record = await fetchWfsResource(gnBaseFromEsUrl(ds.url), uuid)
    if (record) break
  }
  if (!record) return null

  const featureTypeId = encodeURIComponent(`${record.wfsUrl}#${layer.name}`)
  for (const ds of sources) {
    const count = await fetchCount({ url: ds.url, featureTypeId })
    if (count > 0) {
      return { url: ds.url, featureTypeId, fields: profileToFields(record.profile) }
    }
  }
  return null
}

/**
 * Resolve the ES index and filterable columns behind a WMS layer from the context's `dataSources`.
 * `undefined` leaves the layer untouched (not filterable, not indexed, or detection failed).
 */
export async function resolveAttributeFilter(
  layer: MapLayer,
  dataSources: DataSource[],
): Promise<GeoNetworkIndexConnection | undefined> {
  try {
    return (await detectAttributeFilter(layer, dataSources)) ?? undefined
  } catch (error) {
    console.error('Erreur lors de la résolution du filtre attributaire', error)
    return undefined
  }
}

/** Strip the Geonetwork features-index suffix to get the Geonetwork base, e.g. `/geonetwork`. */
export function gnBaseFromEsUrl(esUrl: string): string {
  return esUrl.replace(/\/index\/features\/?$/, '')
}

/** Read the first sublayer's `MetadataURL` from the WMS capabilities and extract its UUID. */
function metadataUuid(endpoint: WmsEndpoint, layerName: string): string | null {
  const firstSublayer = layerName.split(',')[0] ?? layerName
  const metadataUrl = endpoint.getLayerByName(firstSublayer)?.metadata?.[0]?.url
  return metadataUrl ? parseUuid(metadataUrl) : null
}

/** Geonetwork MetadataURL conventions: `?uuid=`/`?id=` query param, or `#/metadata/<uuid>`. */
export function parseUuid(metadataUrl: string): string | null {
  try {
    const params = new URL(metadataUrl, window.location.href).searchParams
    const id = params.get('uuid') ?? params.get('id')
    if (id) return id
  } catch {
    // not an absolute/parseable URL — fall through to the fragment form
  }
  return /#\/metadata\/([^?&]+)/.exec(metadataUrl)?.[1] ?? null
}

/**
 * Translate the profile to filterable columns: visible value-list columns only (date-range and
 * tree facets dropped), French labels, `ft_<COLUMN>_s` aggregation field.
 */
export function profileToFields(profile: GnProfile): IndexField[] {
  const treeFields = new Set(profile.treeFields ?? [])
  return (profile.fields ?? [])
    .filter((f) => !f.hidden && f.type !== 'rangeDate' && !treeFields.has(f.name))
    .map((f) => ({
      esField: f.name,
      label: f.label?.fr ?? f.label?.en ?? f.name,
      aggField: `ft_${f.name}_s`,
      type: 'terms' as const,
    }))
}
