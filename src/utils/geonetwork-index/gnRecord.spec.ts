import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWfsResource } from './gnRecord'

const PROFILE = {
  tokenizedFields: { THEME: ';' },
  fields: [{ name: 'THEME', label: { fr: 'Thème' } }],
  treeFields: ['PARAMETRE'],
}

// Minimal ISO 19115-3 record: a WMS resource (no profile) then the WFS one carrying the profile.
const recordXml = (profile: string | null) => `<?xml version="1.0"?>
<mdb:MD_Metadata xmlns:mdb="http://standards.iso.org/iso/19115/-3/mdb/2.0"
  xmlns:cit="http://standards.iso.org/iso/19115/-3/cit/2.0"
  xmlns:gco="http://standards.iso.org/iso/19115/-3/gco/1.0">
  <cit:CI_OnlineResource>
    <cit:linkage><gco:CharacterString>https://host/services/wms/env</gco:CharacterString></cit:linkage>
    <cit:protocol><gco:CharacterString>OGC:WMS</gco:CharacterString></cit:protocol>
  </cit:CI_OnlineResource>
  <cit:CI_OnlineResource>
    <cit:linkage><gco:CharacterString>https://host/services/wfs/env</gco:CharacterString></cit:linkage>
    <cit:protocol><gco:CharacterString>OGC:WFS</gco:CharacterString></cit:protocol>
    ${profile == null ? '' : `<cit:applicationProfile><gco:CharacterString>${profile}</gco:CharacterString></cit:applicationProfile>`}
  </cit:CI_OnlineResource>
</mdb:MD_Metadata>`

let originalFetch: typeof globalThis.fetch

function mockFetch(text: string, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    text: () => Promise.resolve(text),
  }) as unknown as typeof globalThis.fetch
}

beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchWfsResource', () => {
  it('returns the WFS url and parsed applicationProfile', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    const res = await fetchWfsResource('/geonetwork', 'uuid-1')
    expect(res).toEqual({ wfsUrl: 'https://host/services/wfs/env', profile: PROFILE })
  })

  it('hits the record XML formatter endpoint', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    await fetchWfsResource('/geonetwork', 'uuid-1')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      '/geonetwork/srv/api/records/uuid-1/formatters/xml',
    )
  })

  it('returns null when the WFS resource has no applicationProfile', async () => {
    mockFetch(recordXml(null))
    expect(await fetchWfsResource('/geonetwork', 'uuid-1')).toBeNull()
  })

  it('returns null on a malformed profile JSON', async () => {
    mockFetch(recordXml('{not json'))
    expect(await fetchWfsResource('/geonetwork', 'uuid-1')).toBeNull()
  })

  it('returns null when the fetch fails', async () => {
    mockFetch('', false)
    expect(await fetchWfsResource('/geonetwork', 'uuid-1')).toBeNull()
  })
})
