import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetadataURL } from '@camptocamp/ogc-client'

const mocks = vi.hoisted(() => ({ getLayerByName: vi.fn() }))

vi.mock('@camptocamp/ogc-client', () => ({
  WmsEndpoint: class {
    isReady() {
      return Promise.resolve(this)
    }
    getLayerByName = mocks.getLayerByName
  },
}))

import { gnBaseFromMetadataUrl, parseUuid, resolveRecordRef } from './recordRef'

const SEXTANT_BASE = 'https://sextant.ifremer.fr/geonetwork'

const iso = (url: string): MetadataURL => ({ url, type: 'ISO19115:2003', format: 'text/xml' })

function withMetadata(...metadata: MetadataURL[]) {
  mocks.getLayerByName.mockReturnValue({ metadata })
}

beforeEach(() => {
  mocks.getLayerByName.mockReset()
})

describe('parseUuid', () => {
  it('reads a `uuid` query param', () => {
    expect(parseUuid('https://host/geonetwork/srv/api/records?uuid=abc-1')).toBe('abc-1')
  })

  it('falls back to the `id` query param', () => {
    expect(parseUuid('https://host/geonetwork/srv/records?id=abc-2')).toBe('abc-2')
  })

  it('reads the `#/metadata/<uuid>` fragment form', () => {
    expect(parseUuid('https://host/geonetwork/#/metadata/abc-3')).toBe('abc-3')
  })

  it('reads case-variant CSW params (ID=, Uuid=)', () => {
    expect(parseUuid('https://host/srv/fre/csw?request=GetRecordById&ID=abc-4')).toBe('abc-4')
    expect(parseUuid('https://host/srv/csw?Uuid=abc-5')).toBe('abc-5')
  })

  it('reads the GN REST path form `…/records/<uuid>`', () => {
    expect(parseUuid('https://host/geonetwork/srv/api/records/abc-6')).toBe('abc-6')
    expect(parseUuid('https://host/geonetwork/srv/api/records/abc-7/formatters/xml')).toBe('abc-7')
  })

  it('returns null when no uuid is present', () => {
    expect(parseUuid('https://host/geonetwork/srv/search')).toBeNull()
  })
})

describe('gnBaseFromMetadataUrl', () => {
  // The three MetadataURL forms a Geonetwork emits all go through /srv/, so all three truncate to
  // the same base — which is what makes the truncation usable rather than form-specific.
  it('yields the same base for the CSW KVP form (as Sextant emits it)', () => {
    expect(
      gnBaseFromMetadataUrl(
        `${SEXTANT_BASE}/srv/fre/csw?service=CSW&request=GetRecordById&id=uuid-1`,
      ),
    ).toBe(SEXTANT_BASE)
  })

  it('yields the same base for the `#/metadata/<uuid>` form', () => {
    expect(gnBaseFromMetadataUrl(`${SEXTANT_BASE}/srv/fre/catalog.search#/metadata/uuid-1`)).toBe(
      SEXTANT_BASE,
    )
  })

  it('yields the same base for the `/srv/api/records/<uuid>` form', () => {
    expect(gnBaseFromMetadataUrl(`${SEXTANT_BASE}/srv/api/records/uuid-1`)).toBe(SEXTANT_BASE)
  })

  it('returns null for a URL with no `/srv/`', () => {
    expect(gnBaseFromMetadataUrl('https://host/catalogue/#/metadata/uuid-1')).toBeNull()
  })
})

describe('resolveRecordRef', () => {
  it('resolves the uuid and the base of the record', async () => {
    withMetadata(iso(`${SEXTANT_BASE}/srv/fre/csw?request=GetRecordById&id=uuid-1`))
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toEqual({
      uuid: 'uuid-1',
      gnBase: SEXTANT_BASE,
    })
  })

  it('prefers the ISO entry over an HTML landing page listed first', async () => {
    withMetadata(
      { url: `${SEXTANT_BASE}/srv/fre/catalog.search#/metadata/uuid-html`, format: 'text/html' },
      iso(`${SEXTANT_BASE}/srv/api/records/uuid-1`),
    )
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toEqual({
      uuid: 'uuid-1',
      gnBase: SEXTANT_BASE,
    })
  })

  it('moves on to the next entry when a URL yields no base', async () => {
    withMetadata(
      iso('https://host/catalogue/#/metadata/uuid-nobase'),
      iso(`${SEXTANT_BASE}/srv/api/records/uuid-1`),
    )
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toEqual({
      uuid: 'uuid-1',
      gnBase: SEXTANT_BASE,
    })
  })

  it('still reports the uuid when no entry yields a base (filter detection needs only that)', async () => {
    withMetadata(iso('https://host/catalogue/#/metadata/uuid-nobase'))
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toEqual({
      uuid: 'uuid-nobase',
      gnBase: null,
    })
  })

  it('returns null when the layer declares no usable MetadataURL', async () => {
    withMetadata(iso('https://host/geonetwork/srv/search'))
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toBeNull()
  })

  it('returns null when the sublayer is absent from the capabilities', async () => {
    mocks.getLayerByName.mockReturnValue(undefined)
    expect(await resolveRecordRef('https://host/wms', 'lyr')).toBeNull()
  })
})
