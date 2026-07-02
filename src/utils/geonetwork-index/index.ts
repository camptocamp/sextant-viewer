import { WmsEndpoint } from '@camptocamp/ogc-client'
export { discoverFields, buildFieldFilter, fetchFieldValues, fetchCount } from './attributeIndex'
export type { IndexField, FieldValue, DistinctFieldValues } from './attributeIndex.types'
export { buildOgcFilter, buildWmsFilterParam } from './wms.utils'
export { fetchWfsResources } from './gnRecord'
import { fetchCount } from './attributeIndex'
import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'
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
 *   1. WMS `GetCapabilities` → the first sublayer's `MetadataURL` → record UUID;
 *   2. metadata scan: the first dataSource whose GN base returns a record with `OGC:WFS`
 *      `applicationProfile`(s); each WMS sublayer is matched to the WFS resource listing it as a
 *      feature type, yielding one `featureTypeId` (`${wfsUrl}#${sublayer}`) per sublayer;
 *   3. index scan: the first dataSource whose ES index holds those `featureTypeIds`.
 *
 * Returns `null` when no sublayer maps to a profiled WFS resource or none are indexed.
 */
async function detectAttributeFilter(
  layer: MapLayer,
  dataSources: DataSource[],
): Promise<GeoNetworkIndexConnection | null> {
  if (layer.type !== 'wms' || !layer.url || !layer.name) return null
  const sources = dataSources.filter((ds) => ds.type === 'geonetwork-index')
  if (sources.length === 0) return null

  const sublayers = splitSublayers(layer.name)
  const endpoint = await new WmsEndpoint(layer.url).isReady()
  const uuid = metadataUuid(endpoint, sublayers[0] ?? layer.name)
  if (!uuid) return null

  let resources: GnWfsResource[] = []
  for (const ds of sources) {
    resources = await fetchWfsResources(gnBaseFromEsUrl(ds.url), uuid)
    if (resources.length) break
  }
  if (!resources.length) return null

  // Match each sublayer to the WFS resource that exposes it (a resource with no listed feature
  // types backs every sublayer). All matched sublayers are assumed to share the same profile.
  const featureTypeIds: string[] = []
  let profile: GnWfsResource['profile'] | null = null
  for (const sublayer of sublayers) {
    const resource = resources.find(
      (r) => r.featureTypes.length === 0 || r.featureTypes.includes(sublayer),
    )
    if (!resource) continue
    featureTypeIds.push(encodeURIComponent(`${resource.wfsUrl}#${sublayer}`))
    profile ??= resource.profile
  }
  if (!featureTypeIds.length || !profile) return null

  for (const ds of sources) {
    const count = await fetchCount({ url: ds.url, featureTypeIds })
    if (count > 0) {
      return { url: ds.url, featureTypeIds, fields: profileToFields(profile) }
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

/** Sublayers of a (possibly comma-joined) WMS layer name — each an index join key. */
function splitSublayers(layerName: string): string[] {
  return layerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

/** Read a sublayer's `MetadataURL` from the WMS capabilities and extract its UUID. */
function metadataUuid(endpoint: WmsEndpoint, sublayer: string): string | null {
  const metadataUrl = endpoint.getLayerByName(sublayer)?.metadata?.[0]?.url
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
export function profileToFields(profile: GnWfsApplicationProfile): IndexField[] {
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
