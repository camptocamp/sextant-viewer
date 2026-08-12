import { fieldsFromSource, probeIndex } from './attributeIndex'
import { fetchRecordResources } from './gnRecord'
import { resolveRecordRef } from './recordRef'
import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'
import type { IndexField } from './attributeIndex.types'
import type { MapLayer } from '../layer.utils'
import { splitSublayers } from '../wms.utils'
import type { DataSource } from '@/types/data-source.types'
import type { GeoNetworkIndexConnection } from '@/types/wms.types'

/**
 * Detect whether a WMS layer is filterable and resolve its ES index + filterable columns.
 *
 * A layer's Geonetwork metadata may live on one GeoNetwork while its features are indexed on
 * another, so the two are resolved independently by scanning the context `dataSources`:
 *   1. WMS `GetCapabilities` → the first sublayer's `MetadataURL` → record UUID;
 *   2. metadata scan: the first dataSource whose GN base returns a record with `OGC:WFS`
 *      resource(s); each WMS sublayer is matched to the WFS resource listing it as a feature type,
 *      yielding one `featureTypeId` per matched resource (the indexer keys documents by the
 *      resource's full comma-joined feature-type name, not by individual sublayer);
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
  const uuid = (await resolveRecordRef(layer.url, sublayers[0] ?? layer.name))?.uuid
  if (!uuid) return null

  const resources = await firstResources(sources, uuid)
  const { featureTypeIds, profile } = matchSublayersToResources(sublayers, resources)
  if (!featureTypeIds.length) return null

  return firstIndexedSource(sources, featureTypeIds, profile)
}

/** WFS resources of the first dataSource whose GeoNetwork base returns any for the record. */
async function firstResources(sources: DataSource[], uuid: string): Promise<GnWfsResource[]> {
  for (const ds of sources) {
    // an unreachable source must not stop the scan — the record may live on the next one
    try {
      const { wfs } = await fetchRecordResources(gnBaseFromEsUrl(ds.url), uuid)
      if (wfs.length) return wfs
    } catch (error) {
      console.error(`Métadonnées inaccessibles sur ${ds.url}`, error)
    }
  }
  return []
}

/**
 * Layer-name comparison key: WMS names are often `workspace:name` (GeoServer) while the record's
 * WFS `<cit:name>` lists the bare feature type, and casing can differ between the two services.
 */
function canonicalName(name: string): string {
  return name.split(':').pop()!.toLowerCase()
}

/** True when a WFS resource explicitly lists a feature type matching the sublayer. */
function resourceBacksSublayer(resource: GnWfsResource, sublayer: string): boolean {
  return resource.featureTypes.some((type) => canonicalName(type) === canonicalName(sublayer))
}

/**
 * Match each sublayer to the WFS resource that exposes it, collecting one `featureTypeId` per
 * matched resource and the first profile among them (matched resources share a single profile).
 *
 * The Geonetwork indexer keys documents by the WFS resource's full feature-type name — the
 * `<cit:name>` verbatim, even when it lists several types — so the id is built from the resource's
 * raw name, not per sublayer (a nameless resource falls back to the layer's own name).
 */
function matchSublayersToResources(
  sublayers: string[],
  resources: GnWfsResource[],
): { featureTypeIds: string[]; profile?: GnWfsApplicationProfile } {
  const matched = new Set<GnWfsResource>()
  let profile: GnWfsApplicationProfile | undefined
  for (const sublayer of sublayers) {
    // Prefer a resource explicitly listing the sublayer; a nameless resource backs any sublayer
    // but only as a fallback, so it can't shadow the properly-described one.
    const resource =
      resources.find((r) => resourceBacksSublayer(r, sublayer)) ??
      resources.find((r) => r.featureTypes.length === 0)
    if (!resource) continue
    matched.add(resource)
    profile ??= resource.profile
  }
  const featureTypeIds = [...matched].map((r) =>
    encodeURIComponent(`${r.wfsUrl}#${r.name ?? sublayers.join(',')}`),
  )
  return { featureTypeIds, profile }
}

/**
 * Connection to the first dataSource whose ES index holds the `featureTypeIds`, with its filter
 * columns from the profile when it declares some, otherwise discovered from a sample index
 * document (a profile may only carry tokenizedFields/treeFields — its tokenized markers still
 * apply to the discovered columns).
 */
async function firstIndexedSource(
  sources: DataSource[],
  featureTypeIds: string[],
  profile: GnWfsApplicationProfile | undefined,
): Promise<GeoNetworkIndexConnection | null> {
  for (const ds of sources) {
    const index: GeoNetworkIndexConnection = { url: ds.url, featureTypeIds }
    // an unreachable index must not stop the scan — the features may be indexed on the next one
    try {
      const { total, sampleSource } = await probeIndex(index)
      if (total === 0) continue
      return { ...index, fields: resolveFields(sampleSource, profile) }
    } catch (error) {
      console.error(`Index inaccessible sur ${ds.url}`, error)
    }
  }
  return null
}

/**
 * Filter columns: from the profile when it declares fields, else discovered from the sample
 * document (`probeIndex` already fetched it — the tokenized markers still apply to discovered
 * columns).
 */
function resolveFields(
  sampleSource: Record<string, unknown>,
  profile: GnWfsApplicationProfile | undefined,
): IndexField[] {
  const fromProfile = profile ? profileToFields(profile) : []
  if (fromProfile.length) return fromProfile
  return fieldsFromSource(sampleSource).map((field) => ({
    ...field,
    matchType: profile?.tokenizedFields?.[field.esField] ? 'contains' : 'equals',
  }))
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

/**
 * Translate the profile to filterable columns: visible value-list columns only (date-range and
 * tree facets dropped), French labels, `ft_<COLUMN>_s` aggregation field. Columns declared in
 * `tokenizedFields` compare by substring on the WFS side (`contains`).
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
      matchType: profile.tokenizedFields?.[f.name] ? ('contains' as const) : ('equals' as const),
    }))
}
