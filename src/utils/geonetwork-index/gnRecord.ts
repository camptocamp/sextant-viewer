// Reads the attribute-filter config straight from a Geonetwork metadata record: the record's
// `OGC:WFS` online resource carries the WFS url + an `applicationProfile` JSON whose shape matches
// the `wfs-indexing-config` endpoint. Presence of that profile is what marks a layer filterable.

/** Parsed `applicationProfile` JSON from the WFS online resource. */
export interface GnProfile {
  fields?: Array<{
    name: string
    label?: { fr?: string; en?: string }
    hidden?: boolean
    type?: string
  }>
  tokenizedFields?: Record<string, string>
  treeFields?: string[]
}

/** First descendant text by local name (namespace-agnostic), trimmed. */
function localText(parent: Element, local: string): string | undefined {
  return parent.getElementsByTagNameNS('*', local)[0]?.textContent?.trim() || undefined
}

/**
 * Fetch the metadata record and return its `OGC:WFS` online resource's url + parsed
 * `applicationProfile`. Returns `null` when the record can't be read, has no WFS resource with a
 * profile, or the profile JSON is malformed — i.e. the layer is not filterable.
 */
export async function fetchWfsResource(
  gnBase: string,
  uuid: string,
): Promise<{ wfsUrl: string; profile: GnProfile } | null> {
  const res = await fetch(`${gnBase}/srv/api/records/${uuid}/formatters/xml`)
  if (!res.ok) return null
  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')

  const resources = doc.getElementsByTagNameNS('*', 'CI_OnlineResource')
  for (const resource of Array.from(resources)) {
    if (!localText(resource, 'protocol')?.startsWith('OGC:WFS')) continue
    // ISO 19115-3: the linkage value is a `gco:CharacterString` (not a `<URL>` element).
    const wfsUrl = localText(resource, 'linkage')
    const raw = localText(resource, 'applicationProfile')
    if (!wfsUrl || !raw) continue
    try {
      return { wfsUrl, profile: JSON.parse(raw) as GnProfile }
    } catch {
      return null
    }
  }
  return null
}
