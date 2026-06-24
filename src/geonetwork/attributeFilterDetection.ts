import { WmsEndpoint } from '@camptocamp/ogc-client'
import { isLayerIndexed } from './attributeIndex'
import type { AttributeFieldConfig, AttributeMatch, GeonetworkSource } from './attributeIndex.types'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { DataSource } from '@/types/attribute-filter.types'

/**
 * Detect whether a WMS layer has a filterable ElasticSearch index among the context's
 * `dataSources`, and resolve its source + (best-effort) curated columns.
 *
 * Detection chain:
 *   1. `DescribeLayer` (ogc-client) → the layer's backing WFS service URL;
 *   2. probe each `elasticsearch` data source for a `harvesterReport` document keyed by
 *      `${wfsUrl}#${layers}` — a non-zero hit count means the layer is indexed there;
 *   3. best-effort, read curated column labels/match-types from the layer's Geonetwork
 *      application profile (`wfs-indexing-config`). When that is unavailable, the columns are
 *      auto-discovered from the index downstream.
 *
 * Returns `null` when the layer has no filterable index.
 */
export async function resolveAttributeFilter(
  layer: MapContextLayer,
  dataSources: DataSource[],
): Promise<{ source: GeonetworkSource; fields?: AttributeFieldConfig[] } | null> {
  if (layer.type !== 'wms' || !layer.url || !layer.name) return null
  const esSources = dataSources.filter((ds) => ds.type === 'elasticsearch')
  if (esSources.length === 0) return null

  const firstSublayer = layer.name.split(',')[0] ?? layer.name
  const endpoint = await new WmsEndpoint(layer.url).isReady()
  const description = await endpoint.describeLayer(firstSublayer)
  // owsType is taken verbatim from the DescribeLayer XML; compare case-insensitively.
  if (!description || description.owsType?.toLowerCase() !== 'wfs' || !description.owsUrl)
    return null

  const wfsUrl = wmsUrlToWfs(description.owsUrl)
  const docId = `${wfsUrl}#${layer.name}`

  for (const ds of esSources) {
    if (!(await isLayerIndexed({ url: ds.url }, docId))) continue
    const source: GeonetworkSource = {
      url: ds.url,
      featureType: encodeURIComponent(docId),
    }
    const fields = await fetchGnAttributeFields(
      endpoint,
      gnBaseFromEsUrl(ds.url),
      wfsUrl,
      layer.name,
    )
    return { source, fields }
  }
  return null
}

// Sextant convention — DescribeLayer advertises the WMS endpoint; the index id uses /wfs.
function wmsUrlToWfs(url: string): string {
  return url.replace(/\/wms(\/|$|\?)/, '/wfs$1')
}

/** Strip the Geonetwork features-index suffix to get the Geonetwork base, e.g. `/geonetwork`. */
function gnBaseFromEsUrl(esUrl: string): string {
  return esUrl.replace(/\/index\/features\/?$/, '')
}

interface GnProfile {
  fields?: Array<{
    name: string
    label?: { fr?: string; en?: string }
    hidden?: boolean
    type?: string
  }>
  tokenizedFields?: Record<string, string>
  treeFields?: string[]
}

/**
 * Best-effort curated columns from the Geonetwork application profile. Returns `undefined` on
 * any failure (non-Geonetwork WMS, missing profile, malformed payload) so the caller falls back
 * to auto-discovery from the index.
 */
async function fetchGnAttributeFields(
  endpoint: WmsEndpoint,
  gnBase: string,
  wfsUrl: string,
  name: string,
): Promise<AttributeFieldConfig[] | undefined> {
  try {
    const uuid = metadataUuid(endpoint, name)
    if (!uuid) return undefined
    const profile = await fetchProfile(gnBase, uuid, wfsUrl, name)
    return profile ? profileToFields(profile) : undefined
  } catch (error) {
    console.error('Lecture du profil applicatif Geonetwork échouée', error)
    return undefined
  }
}

/** Read the first sublayer's `MetadataURL` from the WMS capabilities and extract its UUID. */
function metadataUuid(endpoint: WmsEndpoint, layerName: string): string | null {
  const firstSublayer = layerName.split(',')[0] ?? layerName
  const metadataUrl = endpoint.getLayerByName(firstSublayer)?.metadata?.[0]?.url
  return metadataUrl ? parseUuid(metadataUrl) : null
}

/** Geonetwork MetadataURL conventions: `?uuid=`/`?id=` query param, or `#/metadata/<uuid>`. */
function parseUuid(metadataUrl: string): string | null {
  try {
    const params = new URL(metadataUrl, window.location.href).searchParams
    const id = params.get('uuid') ?? params.get('id')
    if (id) return id
  } catch {
    // not an absolute/parseable URL — fall through to the fragment form
  }
  return /#\/metadata\/([^?&]+)/.exec(metadataUrl)?.[1] ?? null
}

/** POST the application profile for a feature type; it comes back as a JSON string at `0`. */
async function fetchProfile(
  base: string,
  uuid: string,
  wfsUrl: string,
  name: string,
): Promise<GnProfile | null> {
  const res = await fetch(`${base}/srv/api/records/${uuid}/query/wfs-indexing-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url: wfsUrl, name, protocol: 'WFS' }),
  })
  const raw = res.ok ? (await res.json())['0'] : null
  if (raw == null) return null
  try {
    // The profile usually arrives as a JSON string, but tolerate an already-parsed object.
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as GnProfile
  } catch {
    // Malformed payload: fall back to index auto-discovery rather than dropping the whole filter.
    return null
  }
}

/**
 * Translate the profile to the component's field config: visible value-list columns only
 * (date-range and tree facets dropped), French labels, `ft_<COLUMN>_s` aggregation field,
 * and `contains` for `;`-tokenized columns (`equals` otherwise).
 */
function profileToFields(profile: GnProfile): AttributeFieldConfig[] {
  const tokenized = profile.tokenizedFields ?? {}
  const treeFields = new Set(profile.treeFields ?? [])
  return (profile.fields ?? [])
    .filter((f) => !f.hidden && f.type !== 'rangeDate' && !treeFields.has(f.name))
    .map((f) => ({
      esField: f.name,
      label: f.label?.fr ?? f.label?.en ?? f.name,
      aggField: `ft_${f.name}_s`,
      match: (tokenized[f.name] != null ? 'contains' : 'equals') as AttributeMatch,
    }))
}
