import { WmsEndpoint, type MetadataURL } from '@camptocamp/ogc-client'

/** ISO/CSW metadata entries carry the record; HTML landing pages often come first in capabilities. */
function isIsoMetadata(entry: MetadataURL): boolean {
  return /19115|TC211/i.test(entry.type ?? '') || /xml/i.test(entry.format ?? '')
}

/**
 * The record designated by a WMS sublayer's `MetadataURL`: its uuid, and the GeoNetwork serving it.
 *
 * The two consumers need different halves. Filter detection only needs the uuid — it looks the
 * record up on the catalog that indexed the features, which may not be this one — while WPS
 * detection needs the base too, since the processes are declared by this very record. Hence the
 * preference for an entry giving both, with an uuid-only entry kept as a fallback: an URL the base
 * can't be derived from still identifies the record.
 *
 * No request of its own: the WMS `GetCapabilities` is already in ogc-client's cache by the time the
 * background detections run (the awaited enrichment pass fetched it).
 */
export async function resolveRecordRef(
  wmsUrl: string,
  sublayer: string,
): Promise<{ uuid: string; gnBase: string | null } | null> {
  const endpoint = await new WmsEndpoint(wmsUrl).isReady()
  const entries = endpoint.getLayerByName(sublayer)?.metadata ?? []
  const sorted = [...entries].sort((a, b) => Number(isIsoMetadata(b)) - Number(isIsoMetadata(a)))

  let uuidOnly: { uuid: string; gnBase: null } | null = null
  for (const entry of sorted) {
    if (!entry.url) continue
    const uuid = parseUuid(entry.url)
    if (!uuid) continue
    const gnBase = gnBaseFromMetadataUrl(entry.url)
    if (gnBase) return { uuid, gnBase }
    uuidOnly ??= { uuid, gnBase: null }
  }
  return uuidOnly
}

/**
 * GeoNetwork base of a `MetadataURL`, by truncating at `/srv/` — the segment every GeoNetwork
 * service path goes through, whichever form the link takes (CSW KVP, `#/metadata/<uuid>` catalog
 * search, or the `/srv/api/records/<uuid>` REST path). Used verbatim, with no URL rewriting.
 * `null` when the URL has no `/srv/`, which means it is not a GeoNetwork we know how to read.
 */
export function gnBaseFromMetadataUrl(metadataUrl: string): string | null {
  const index = metadataUrl.indexOf('/srv/')
  return index === -1 ? null : metadataUrl.slice(0, index)
}

/**
 * Geonetwork MetadataURL conventions: `?uuid=`/`?id=` query param (case-insensitive, as CSW KVP
 * is), `#/metadata/<uuid>` fragment, or the GN REST path `…/records/<uuid>`.
 */
export function parseUuid(metadataUrl: string): string | null {
  try {
    const url = new URL(metadataUrl, globalThis.location.href)
    for (const [key, value] of url.searchParams) {
      if ((key.toLowerCase() === 'uuid' || key.toLowerCase() === 'id') && value) return value
    }
    const fragment = /#\/metadata\/([^?&]+)/.exec(metadataUrl)?.[1]
    if (fragment) return fragment
    const restPath = /\/records\/([^/?#]+)/.exec(url.pathname)?.[1]
    if (restPath) return decodeURIComponent(restPath)
  } catch {
    // not an absolute/parseable URL — fall through to the fragment form
  }
  return /#\/metadata\/([^?&]+)/.exec(metadataUrl)?.[1] ?? null
}
