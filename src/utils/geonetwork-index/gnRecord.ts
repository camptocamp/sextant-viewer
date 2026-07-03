import type { GnWfsApplicationProfile, GnWfsResource } from './gnRecord.types'

// ISO value wrappers: `gco:CharacterString` (both schemas), `gmd:URL` (19139 linkage),
// `gcx:Anchor`/`gmx:Anchor` (linked values).
const VALUE_LOCAL_NAMES = ['CharacterString', 'URL', 'Anchor']

/**
 * Text of a property's value element by local name (namespace-agnostic), trimmed.
 *
 * The value child is read instead of the property's `textContent`: on multilingual records the
 * property also carries `PT_FreeText` translations, which `textContent` would concatenate into
 * the value. Falls back to the property's own text for records inlining the value.
 */
function localText(parent: Element, local: string): string | undefined {
  const property = parent.getElementsByTagNameNS('*', local)[0]
  if (!property) return undefined
  const value = Array.from(property.children).find((c) => VALUE_LOCAL_NAMES.includes(c.localName))
  return (value ?? property).textContent?.trim() || undefined
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

    const name = localText(resource, 'name')
    const featureTypes = (name ?? '')
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean)

    out.push({
      wfsUrl,
      name,
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
