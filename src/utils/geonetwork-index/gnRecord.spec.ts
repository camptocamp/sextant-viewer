import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWfsResources } from './gnRecord'

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
    <cit:name><gco:CharacterString>point,ligne</gco:CharacterString></cit:name>
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

describe('fetchWfsResources', () => {
  it('returns each WFS resource with its url, feature types and parsed profile', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    const res = await fetchWfsResources('/geonetwork', 'uuid-1')
    expect(res).toEqual([
      {
        wfsUrl: 'https://host/services/wfs/env',
        name: 'point,ligne',
        featureTypes: ['point', 'ligne'],
        profile: PROFILE,
      },
    ])
  })

  it('hits the record XML formatter endpoint', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    await fetchWfsResources('/geonetwork', 'uuid-1')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      '/geonetwork/srv/api/records/uuid-1/formatters/xml',
    )
  })

  it('keeps a WFS resource with no applicationProfile (profile undefined)', async () => {
    mockFetch(recordXml(null))
    expect(await fetchWfsResources('/geonetwork', 'uuid-1')).toEqual([
      {
        wfsUrl: 'https://host/services/wfs/env',
        name: 'point,ligne',
        featureTypes: ['point', 'ligne'],
        profile: undefined,
      },
    ])
  })

  it('keeps a resource with malformed profile JSON (profile undefined)', async () => {
    mockFetch(recordXml('{not json'))
    expect(await fetchWfsResources('/geonetwork', 'uuid-1')).toEqual([
      {
        wfsUrl: 'https://host/services/wfs/env',
        name: 'point,ligne',
        featureTypes: ['point', 'ligne'],
        profile: undefined,
      },
    ])
  })

  it('returns [] when the fetch fails', async () => {
    mockFetch('', false)
    expect(await fetchWfsResources('/geonetwork', 'uuid-1')).toEqual([])
  })

  it('only scans the distribution section when the record has one', async () => {
    mockFetch(`<?xml version="1.0"?>
<mdb:MD_Metadata xmlns:mdb="http://standards.iso.org/iso/19115/-3/mdb/2.0"
  xmlns:mrd="http://standards.iso.org/iso/19115/-3/mrd/1.0"
  xmlns:cit="http://standards.iso.org/iso/19115/-3/cit/2.0"
  xmlns:gco="http://standards.iso.org/iso/19115/-3/gco/1.0">
  <!-- coupled-service citation outside the distribution: must be ignored -->
  <cit:CI_OnlineResource>
    <cit:linkage><gco:CharacterString>https://other-host/wfs</gco:CharacterString></cit:linkage>
    <cit:protocol><gco:CharacterString>OGC:WFS</gco:CharacterString></cit:protocol>
  </cit:CI_OnlineResource>
  <mdb:distributionInfo><mrd:MD_Distribution>
    <cit:CI_OnlineResource>
      <cit:linkage><gco:CharacterString>https://host/services/wfs/env</gco:CharacterString></cit:linkage>
      <cit:protocol><gco:CharacterString>OGC:WFS</gco:CharacterString></cit:protocol>
      <cit:name><gco:CharacterString>point</gco:CharacterString></cit:name>
    </cit:CI_OnlineResource>
  </mrd:MD_Distribution></mdb:distributionInfo>
</mdb:MD_Metadata>`)
    expect(await fetchWfsResources('/geonetwork', 'uuid-1')).toEqual([
      {
        wfsUrl: 'https://host/services/wfs/env',
        name: 'point',
        featureTypes: ['point'],
        profile: undefined,
      },
    ])
  })

  it('keeps the raw name verbatim while trimming the split feature types', async () => {
    mockFetch(
      recordXml(JSON.stringify(PROFILE)).replace(
        '<gco:CharacterString>point,ligne</gco:CharacterString>',
        '<gco:CharacterString>point, ligne</gco:CharacterString>',
      ),
    )
    const [resource] = await fetchWfsResources('/geonetwork', 'uuid-1')
    expect(resource!.name).toBe('point, ligne')
    expect(resource!.featureTypes).toEqual(['point', 'ligne'])
  })

  it('ignores PT_FreeText translations on multilingual records', async () => {
    mockFetch(`<?xml version="1.0"?>
<mdb:MD_Metadata xmlns:mdb="http://standards.iso.org/iso/19115/-3/mdb/2.0"
  xmlns:cit="http://standards.iso.org/iso/19115/-3/cit/2.0"
  xmlns:lan="http://standards.iso.org/iso/19115/-3/lan/1.0"
  xmlns:gco="http://standards.iso.org/iso/19115/-3/gco/1.0">
  <cit:CI_OnlineResource>
    <cit:linkage>
      <gco:CharacterString>https://host/services/wfs/env</gco:CharacterString>
      <lan:PT_FreeText><lan:textGroup>
        <lan:LocalisedCharacterString locale="#EN">https://host/en/wfs</lan:LocalisedCharacterString>
      </lan:textGroup></lan:PT_FreeText>
    </cit:linkage>
    <cit:protocol><gco:CharacterString>OGC:WFS</gco:CharacterString></cit:protocol>
    <cit:name>
      <gco:CharacterString>point,ligne</gco:CharacterString>
      <lan:PT_FreeText><lan:textGroup>
        <lan:LocalisedCharacterString locale="#EN">point_en,ligne_en</lan:LocalisedCharacterString>
      </lan:textGroup></lan:PT_FreeText>
    </cit:name>
    <cit:applicationProfile><gco:CharacterString>${JSON.stringify(PROFILE)}</gco:CharacterString></cit:applicationProfile>
  </cit:CI_OnlineResource>
</mdb:MD_Metadata>`)
    expect(await fetchWfsResources('/geonetwork', 'uuid-1')).toEqual([
      {
        wfsUrl: 'https://host/services/wfs/env',
        name: 'point,ligne',
        featureTypes: ['point', 'ligne'],
        profile: PROFILE,
      },
    ])
  })
})
