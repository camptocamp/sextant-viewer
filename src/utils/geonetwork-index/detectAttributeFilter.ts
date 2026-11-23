import { WfsEndpoint } from '@camptocamp/ogc-client'
import { fieldsFromSource, hasGeometry, probeIndex } from './attributeIndex'
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
 *   3. index scan: the first dataSource whose ES index holds those `featureTypeIds`;
 *   4. when the index holds geometries, the WFS geometry property (geographic-area filter).
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
  const { featureTypeIds, profile, featureType } = matchSublayersToResources(sublayers, resources)
  if (!featureTypeIds.length || !featureType) return null

  const indexed = await firstIndexedSource(sources, featureTypeIds)
  if (!indexed) return null

  const { index, sampleSource } = indexed
  const geometryName = hasGeometry(sampleSource)
    ? await resolveGeometryName(featureType)
    : undefined
  return {
    ...index,
    fields: resolveFields(sampleSource, profile),
    ...(geometryName && { geometryName }),
  }
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

/** A WFS feature type backing the layer: its service and its name there. */
interface WfsFeatureTypeRef {
  wfsUrl: string
  name: string
}

/**
 * Match each sublayer to the WFS resource that exposes it, collecting one `featureTypeId` per
 * matched resource, the first profile among them (matched resources share a single profile) and
 * the first matched feature type.
 *
 * The Geonetwork indexer keys documents by the WFS resource's full feature-type name — the
 * `<cit:name>` verbatim, even when it lists several types — so the id is built from the resource's
 * raw name, not per sublayer (a nameless resource falls back to the layer's own name).
 */
function matchSublayersToResources(
  sublayers: string[],
  resources: GnWfsResource[],
): {
  featureTypeIds: string[]
  profile?: GnWfsApplicationProfile
  featureType?: WfsFeatureTypeRef
} {
  const matched = new Set<GnWfsResource>()
  let profile: GnWfsApplicationProfile | undefined
  let featureType: WfsFeatureTypeRef | undefined
  for (const sublayer of sublayers) {
    // Prefer a resource explicitly listing the sublayer; a nameless resource backs any sublayer
    // but only as a fallback, so it can't shadow the properly-described one.
    const resource =
      resources.find((r) => resourceBacksSublayer(r, sublayer)) ??
      resources.find((r) => r.featureTypes.length === 0)
    if (!resource) continue
    matched.add(resource)
    profile ??= resource.profile
    featureType ??= {
      wfsUrl: resource.wfsUrl,
      name:
        resource.featureTypes.find((t) => canonicalName(t) === canonicalName(sublayer)) ?? sublayer,
    }
  }
  const featureTypeIds = [...matched].map((r) =>
    encodeURIComponent(`${r.wfsUrl}#${r.name ?? sublayers.join(',')}`),
  )
  return { featureTypeIds, profile, featureType }
}

/**
 * The first dataSource whose ES index holds the `featureTypeIds`, with one of its documents (to
 * discover columns and whether geometries are indexed).
 */
async function firstIndexedSource(
  sources: DataSource[],
  featureTypeIds: string[],
): Promise<{ index: GeoNetworkIndexConnection; sampleSource: Record<string, unknown> } | null> {
  for (const ds of sources) {
    const index: GeoNetworkIndexConnection = { url: ds.url, featureTypeIds }
    // an unreachable index must not stop the scan — the features may be indexed on the next one
    try {
      const { total, sampleSource } = await probeIndex(index)
      if (total === 0) continue
      return { index, sampleSource }
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
  return fieldsFromSource(sampleSource).map((field): IndexField => {
    const tokenSeparator = profile?.tokenizedFields?.[field.esField]
    if (field.type === 'tree') return { ...field, tokenSeparator }
    if (field.type === 'terms')
      return { ...field, matchType: tokenSeparator ? 'contains' : 'equals' }
    return field
  })
}

/**
 * The WFS geometry property of a feature type backing the layer, which the OGC `BBOX` of the
 * geographic-area filter names. `undefined` (no area filter) when the WFS can't tell.
 */
async function resolveGeometryName({
  wfsUrl,
  name,
}: WfsFeatureTypeRef): Promise<string | undefined> {
  try {
    const endpoint = await new WfsEndpoint(wfsUrl).isReady()
    return (await endpoint.getFeatureTypeFull(name)).geometryName
  } catch (error) {
    console.error(`Géométrie WFS introuvable pour ${name} sur ${wfsUrl}`, error)
    return undefined
  }
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
 * Translate the profile to filterable columns (visible ones, French labels):
 * - `rangeDate` fields become date ranges over their `minField`/`maxField` columns (skipped when
 *   either is missing);
 * - `treeFields` columns become trees on `ft_<COLUMN>_s_tree`;
 * - the others become value lists on `ft_<COLUMN>_s`, compared by substring on the WFS side
 *   (`contains`) when declared in `tokenizedFields`.
 */
export function profileToFields(profile: GnWfsApplicationProfile): IndexField[] {
  const treeFields = new Set(profile.treeFields ?? [])
  return (profile.fields ?? [])
    .filter((f) => !f.hidden)
    .flatMap((f): IndexField[] => {
      const esField = f.name
      const label = f.label?.fr ?? f.label?.en ?? f.name
      const tokenSeparator = profile.tokenizedFields?.[f.name]
      if (f.type === 'rangeDate') {
        if (!f.minField || !f.maxField) return []
        return [{ esField, label, type: 'dateRange', minField: f.minField, maxField: f.maxField }]
      }
      if (treeFields.has(f.name)) {
        return [{ esField, label, type: 'tree', aggField: `ft_${f.name}_s_tree`, tokenSeparator }]
      }
      const matchType = tokenSeparator ? 'contains' : 'equals'
      return [{ esField, label, type: 'terms', aggField: `ft_${f.name}_s`, matchType }]
    })
}
