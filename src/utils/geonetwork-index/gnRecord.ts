import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'

/** First descendant text by local name (namespace-agnostic), trimmed. */
function localText(parent: Element, local: string): string | undefined {
  return parent.getElementsByTagNameNS('*', local)[0]?.textContent?.trim() || undefined
}

/**
 * Fetch the metadata record and return every `OGC:WFS` online resource, with the feature types it
 * exposes and its parsed `applicationProfile` when present. Returns `[]` when the record can't be
 * read or has no WFS resource. A resource keeps its `profile` undefined when it carries none or the
 * JSON is malformed — detection then discovers the filter columns from the index instead.
 */
export async function fetchWfsResources(gnBase: string, uuid: string): Promise<GnWfsResource[]> {
  const res = await fetch(`${gnBase}/srv/api/records/${uuid}/formatters/xml`)
  if (!res.ok) return []

  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')

  const out: GnWfsResource[] = []
  for (const resource of Array.from(doc.getElementsByTagNameNS('*', 'CI_OnlineResource'))) {
    if (!localText(resource, 'protocol')?.startsWith('OGC:WFS')) continue

    // `linkage` text is the URL in both schemas: 19115-3 wraps a `gco:CharacterString`,
    // 19139 a `gmd:URL` — `localText` reads either via `textContent`.
    const wfsUrl = localText(resource, 'linkage')
    if (!wfsUrl) continue

    const featureTypes = (localText(resource, 'name') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)

    out.push({
      wfsUrl,
      featureTypes,
      profile: parseProfile(localText(resource, 'applicationProfile')),
    })
  }

  return out
}

/** Parse the `applicationProfile` JSON; `undefined` when absent or malformed. */
function parseProfile(raw: string | undefined): GnWfsApplicationProfile | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as GnWfsApplicationProfile
  } catch {
    return undefined
  }
}
