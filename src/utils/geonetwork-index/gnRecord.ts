import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'

/** First descendant text by local name (namespace-agnostic), trimmed. */
function localText(parent: Element, local: string): string | undefined {
  return parent.getElementsByTagNameNS('*', local)[0]?.textContent?.trim() || undefined
}

/**
 * Fetch the metadata record and return every `OGC:WFS` online resource carrying a parsed
 * `applicationProfile`, with the feature types it exposes. Returns `[]` when the record can't be
 * read or has no such resource. Resources with a malformed profile JSON are skipped individually.
 */
export async function fetchWfsResources(gnBase: string, uuid: string): Promise<GnWfsResource[]> {
  const res = await fetch(`${gnBase}/srv/api/records/${uuid}/formatters/xml`)
  if (!res.ok) return []

  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')

  const out: GnWfsResource[] = []
  for (const resource of Array.from(doc.getElementsByTagNameNS('*', 'CI_OnlineResource'))) {
    if (!localText(resource, 'protocol')?.startsWith('OGC:WFS')) continue

    // ISO 19115-3: the linkage value is a `gco:CharacterString` (not a `<URL>` element).
    const wfsUrl = localText(resource, 'linkage')
    const raw = localText(resource, 'applicationProfile')
    if (!wfsUrl || !raw) continue

    let profile: GnWfsApplicationProfile
    try {
      profile = JSON.parse(raw) as GnWfsApplicationProfile
    } catch {
      continue
    }

    const featureTypes = (localText(resource, 'name') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)

    out.push({ wfsUrl, featureTypes, profile })
  }

  return out
}
