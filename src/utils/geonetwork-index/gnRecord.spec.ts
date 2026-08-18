import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRecordResourcesCache, fetchRecordResources } from './gnRecord'

const PROFILE = {
  tokenizedFields: { THEME: ';' },
  fields: [{ name: 'THEME', label: { fr: 'Thème' } }],
  treeFields: ['PARAMETRE'],
}

// The Surval extraction profile: its inputs are wired onto the layer's attribute filter.
const WPS_PROFILE = {
  inputs: [
    {
      identifier: 'theme',
      linkedWfsFilter: 'THEME',
      hidden: true,
      tokenizeWfsFilterValues: true,
      wfsFilterValuesDelimiter: ';',
    },
    { identifier: 'date_min', linkedWfsFilter: 'range_Date.from', hidden: true },
    { identifier: 'limits', linkedWfsFilter: 'geometry', hidden: true },
  ],
  outputs: [{ identifier: 'result', defaultMimeType: 'application/zip' }],
}

const wpsResource = (name: string | null, profile: string | null) => `
  <cit:CI_OnlineResource>
    <cit:linkage><gco:CharacterString>https://host/services/wps/extraction</gco:CharacterString></cit:linkage>
    <cit:protocol><gco:CharacterString>OGC:WPS</gco:CharacterString></cit:protocol>
    ${name == null ? '' : `<cit:name><gco:CharacterString>${name}</gco:CharacterString></cit:name>`}
    <cit:description><gco:CharacterString>Extraction des données d'observation</gco:CharacterString></cit:description>
    ${profile == null ? '' : `<cit:applicationProfile><gco:CharacterString>${profile}</gco:CharacterString></cit:applicationProfile>`}
  </cit:CI_OnlineResource>`

// Minimal ISO 19115-3 record: a WMS resource (no profile) then the WFS one carrying the profile.
const recordXml = (profile: string | null, extra = '') => `<?xml version="1.0"?>
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
  ${extra}
</mdb:MD_Metadata>`

const WFS_RESOURCE = {
  wfsUrl: 'https://host/services/wfs/env',
  name: 'point,ligne',
  featureTypes: ['point', 'ligne'],
  profile: PROFILE,
}

let originalFetch: typeof globalThis.fetch

function mockFetch(text: string, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    text: () => Promise.resolve(text),
  }) as unknown as typeof globalThis.fetch
}

const fetchMock = () => globalThis.fetch as ReturnType<typeof vi.fn>

beforeEach(() => {
  originalFetch = globalThis.fetch
  // The memo lives for the session, so one spec's record must not answer the next one's request.
  clearRecordResourcesCache()
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchRecordResources — WFS resources', () => {
  it('returns each WFS resource with its url, feature types and parsed profile', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toEqual([WFS_RESOURCE])
  })

  it('hits the record XML formatter endpoint', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    await fetchRecordResources('/geonetwork', 'uuid-1')
    expect(fetchMock().mock.calls[0]![0]).toBe('/geonetwork/srv/api/records/uuid-1/formatters/xml')
  })

  it('keeps a WFS resource with no applicationProfile (profile undefined)', async () => {
    mockFetch(recordXml(null))
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toEqual([
      { ...WFS_RESOURCE, profile: undefined },
    ])
  })

  it('keeps a resource with malformed profile JSON (profile undefined)', async () => {
    mockFetch(recordXml('{not json'))
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toEqual([
      { ...WFS_RESOURCE, profile: undefined },
    ])
  })

  it('returns no resource at all when the fetch fails', async () => {
    mockFetch('', false)
    expect(await fetchRecordResources('/geonetwork', 'uuid-1')).toEqual({ wfs: [], wps: [] })
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
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toEqual([
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
    const [resource] = (await fetchRecordResources('/geonetwork', 'uuid-1')).wfs
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
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toEqual([WFS_RESOURCE])
  })
})

describe('fetchRecordResources — WPS resources', () => {
  it('reads the process id, label and profile of an OGC:WPS resource', async () => {
    mockFetch(recordXml(null, wpsResource('script:surval-extraction', JSON.stringify(WPS_PROFILE))))
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wps).toEqual([
      {
        url: 'https://host/services/wps/extraction',
        processId: 'script:surval-extraction',
        label: "Extraction des données d'observation",
        profile: WPS_PROFILE,
      },
    ])
  })

  it('keeps a WPS resource whose profile JSON is malformed (profile undefined)', async () => {
    mockFetch(recordXml(null, wpsResource('script:surval-extraction', '{not json')))
    const [process] = (await fetchRecordResources('/geonetwork', 'uuid-1')).wps
    expect(process!.processId).toBe('script:surval-extraction')
    expect(process!.profile).toBeUndefined()
  })

  it('ignores a WPS resource with no <cit:name> — no process id, no DescribeProcess', async () => {
    mockFetch(recordXml(null, wpsResource(null, JSON.stringify(WPS_PROFILE))))
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wps).toEqual([])
  })

  it('reads both protocols of the same record in one request', async () => {
    mockFetch(
      recordXml(
        JSON.stringify(PROFILE),
        wpsResource('script:surval-extraction', JSON.stringify(WPS_PROFILE)),
      ),
    )
    const { wfs, wps } = await fetchRecordResources('/geonetwork', 'uuid-1')
    expect(wfs).toEqual([WFS_RESOURCE])
    expect(wps).toHaveLength(1)
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })
})

describe('fetchRecordResources — memoisation', () => {
  it('shares the in-flight request between concurrent callers', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    // Not awaited in turn: this is the real case — two layers of one record enriched in one tick.
    const [first, second] = await Promise.all([
      fetchRecordResources('/geonetwork', 'uuid-1'),
      fetchRecordResources('/geonetwork', 'uuid-1'),
    ])
    expect(fetchMock()).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('normalises the base so a relative and an absolute form share the entry', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    await fetchRecordResources('/geonetwork', 'uuid-1')
    await fetchRecordResources(new URL('/geonetwork', globalThis.location.href).href, 'uuid-1')
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })

  it('keeps records apart by uuid and by base', async () => {
    mockFetch(recordXml(JSON.stringify(PROFILE)))
    await fetchRecordResources('/geonetwork', 'uuid-1')
    await fetchRecordResources('/geonetwork', 'uuid-2')
    await fetchRecordResources('/other-gn', 'uuid-1')
    expect(fetchMock()).toHaveBeenCalledTimes(3)
  })

  it('memoises a failed response — it is an answer, not an outage', async () => {
    mockFetch('', false)
    await fetchRecordResources('/geonetwork', 'uuid-1')
    await fetchRecordResources('/geonetwork', 'uuid-1')
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })

  it('does not memoise a rejected request — a transient outage must be retried', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(recordXml(null)) })
    await expect(fetchRecordResources('/geonetwork', 'uuid-1')).rejects.toThrow('offline')
    expect((await fetchRecordResources('/geonetwork', 'uuid-1')).wfs).toHaveLength(1)
    expect(fetchMock()).toHaveBeenCalledTimes(2)
  })
})
