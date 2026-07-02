import { WmsEndpoint } from '@camptocamp/ogc-client'
export { discoverFields, buildFieldFilter, fetchFieldValues, fetchCount } from './attributeIndex'
export type { IndexField, FieldValue, DistinctFieldValues } from './attributeIndex.types'
export { buildOgcFilter, buildWmsFilterParam } from './wms.utils'
export { fetchWfsResources } from './gnRecord'
import { discoverFields, fetchCount } from './attributeIndex'
import { fetchWfsResources } from './gnRecord'
import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'
import { buildWmsFilterParam } from './wms.utils'
import type { IndexField } from './attributeIndex.types'
import type { MapLayer } from '../layer.utils'
import { splitSublayers } from '../wms.utils'
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
 *      resource(s); each WMS sublayer is matched to the WFS resource listing it as a feature type,
 *      yielding one `featureTypeId` (`${wfsUrl}#${sublayer}`) per sublayer;
 *   3. index scan: the first dataSource whose ES index holds those `featureTypeIds`.
 *
 * Filter columns come from the record's `applicationProfile` when present, otherwise they are
 * discovered from a sample index document. Returns `null` when no sublayer maps to a WFS resource
 * or none are indexed.
 */
async function detectAttributeFilter(
  layer: MapLayer,
  dataSources: DataSource[],
): Promise<GeoNetworkIndexConnection | null> {
  if (layer.type !== 'wms' || !layer.url || !layer.name) return null
  const sources = dataSources.filter((ds) => ds.type === 'geonetwork-index')
  if (sources.length === 0) return null

  const sublayers = splitSublayers(layer.name)
  const uuid = await resolveRecordUuid(layer.url, sublayers[0] ?? layer.name)
  if (!uuid) return null

  const resources = await firstResources(sources, uuid)
  const { featureTypeIds, profile } = matchSublayersToResources(sublayers, resources)
  if (!featureTypeIds.length) return null

  return firstIndexedSource(sources, featureTypeIds, profile)
}

/** WMS `GetCapabilities` → the sublayer's `MetadataURL` → record UUID. */
async function resolveRecordUuid(wmsUrl: string, sublayer: string): Promise<string | null> {
  const endpoint = await new WmsEndpoint(wmsUrl).isReady()
  const metadataUrl = endpoint.getLayerByName(sublayer)?.metadata?.[0]?.url
  return metadataUrl ? parseUuid(metadataUrl) : null
}

/** WFS resources of the first dataSource whose GeoNetwork base returns any for the record. */
async function firstResources(sources: DataSource[], uuid: string): Promise<GnWfsResource[]> {
  for (const ds of sources) {
    const resources = await fetchWfsResources(gnBaseFromEsUrl(ds.url), uuid)
    if (resources.length) return resources
  }
  return []
}

/** True when a WFS resource backs a sublayer — explicitly, or implicitly if it lists none. */
function resourceBacksSublayer(resource: GnWfsResource, sublayer: string): boolean {
  return resource.featureTypes.length === 0 || resource.featureTypes.includes(sublayer)
}

/**
 * Match each sublayer to the WFS resource that exposes it, collecting one `featureTypeId` per
 * matched sublayer and the first profile among them (matched sublayers share a single profile).
 */
function matchSublayersToResources(
  sublayers: string[],
  resources: GnWfsResource[],
): { featureTypeIds: string[]; profile?: GnWfsApplicationProfile } {
  const featureTypeIds: string[] = []
  let profile: GnWfsApplicationProfile | undefined
  for (const sublayer of sublayers) {
    const resource = resources.find((r) => resourceBacksSublayer(r, sublayer))
    if (!resource) continue
    featureTypeIds.push(encodeURIComponent(`${resource.wfsUrl}#${sublayer}`))
    profile ??= resource.profile
  }
  return { featureTypeIds, profile }
}

/**
 * Connection to the first dataSource whose ES index holds the `featureTypeIds`, with its filter
 * columns from the profile when present, otherwise discovered from a sample index document.
 */
async function firstIndexedSource(
  sources: DataSource[],
  featureTypeIds: string[],
  profile: GnWfsApplicationProfile | undefined,
): Promise<GeoNetworkIndexConnection | null> {
  for (const ds of sources) {
    const index: GeoNetworkIndexConnection = { url: ds.url, featureTypeIds }
    if ((await fetchCount(index)) === 0) continue
    return { ...index, fields: profile ? profileToFields(profile) : await discoverFields(index) }
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
