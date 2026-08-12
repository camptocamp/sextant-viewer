import type {
  GnWfsApplicationProfile,
  GnWfsResource,
  GnWpsResource,
  RecordResources,
} from './gnRecord.types'
import type { WpsApplicationProfile } from '@/types/wps.types'

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

const inflight = new Map<string, Promise<RecordResources>>()

/**
 * Exploitable online resources of the record, by protocol — one request and one DOM parse for both.
 *
 * Memoised on `(normalised base, uuid)`, so the N layers of a single record cost one request; the
 * promise is what is stored, because two layers are enriched in the same tick and a result cache
 * would miss both (the `get` fails, then the function suspends on the `fetch` before it could
 * `set`). Lifetime is the session, like ogc-client's capabilities cache.
 */
export function fetchRecordResources(gnBase: string, uuid: string): Promise<RecordResources> {
  const key = `${new URL(gnBase, window.location.href).href}#${uuid}`
  let promise = inflight.get(key)
  if (!promise) {
    promise = fetchRecord(gnBase, uuid)
    inflight.set(key, promise)
    // A transient network failure must not condemn the record for the whole session. The derived
    // chain swallows nothing for the callers, and keeps this from being an unhandled rejection.
    promise.catch(() => inflight.delete(key))
  }
  return promise
}

/** Drop the memoised records — tests only, so one spec's mocked fetch can't serve the next. */
export function clearRecordResourcesCache() {
  inflight.clear()
}

/**
 * Fetch the metadata record and split its online resources by protocol. A failed response is an
 * empty result rather than a throw — and, being a response, stays memoised.
 *
 * A resource keeps its `profile` undefined when it carries none or the JSON is malformed: filter
 * detection then discovers the columns from the index, and a WPS form falls back to its
 * `DescribeProcess`.
 */
async function fetchRecord(gnBase: string, uuid: string): Promise<RecordResources> {
  const res = await fetch(`${gnBase}/srv/api/records/${encodeURIComponent(uuid)}/formatters/xml`)
  if (!res.ok) return { wfs: [], wps: [] }

  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')

  const wfs: GnWfsResource[] = []
  const wps: GnWpsResource[] = []
  for (const resource of distributionOnlineResources(doc)) {
    const protocol = localText(resource, 'protocol') ?? ''

    // `linkage` text is the URL in both schemas: 19115-3 wraps a `gco:CharacterString`,
    // 19139 a `gmd:URL` — `localText` reads either via `textContent`.
    const url = localText(resource, 'linkage')
    if (!url) continue

    const name = localText(resource, 'name')
    const profile = localText(resource, 'applicationProfile')

    if (protocol.startsWith('OGC:WFS')) {
      wfs.push({
        wfsUrl: url,
        name,
        featureTypes: (name ?? '')
          .split(',')
          .map((type) => type.trim())
          .filter(Boolean),
        profile: parseProfile<GnWfsApplicationProfile>(profile),
      })
    } else if (protocol.startsWith('OGC:WPS')) {
      // Without a process identifier no DescribeProcess is possible, so there is no form to build.
      if (!name) continue
      wps.push({
        url,
        processId: name,
        label: localText(resource, 'description'),
        profile: parseProfile<WpsApplicationProfile>(profile),
      })
    }
  }

  return { wfs, wps }
}

/**
 * Online resources of the record's distribution section(s) only. Records also carry
 * `CI_OnlineResource` in metadata linkage, lineage or coupled-service citations; those must not
 * shadow the distribution's WFS or WPS. Falls back to the whole document when the record has no
 * distribution section.
 */
function distributionOnlineResources(doc: Document): Element[] {
  const sections = Array.from(doc.getElementsByTagNameNS('*', 'distributionInfo'))
  const scopes = sections.length ? sections : [doc.documentElement]
  return scopes.flatMap((scope) =>
    Array.from(scope.getElementsByTagNameNS('*', 'CI_OnlineResource')),
  )
}

/**
 * Parse an `applicationProfile` JSON; `undefined` when absent or malformed. Generic because the WFS
 * and WPS profiles share nothing but the tolerant parse.
 */
function parseProfile<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}
