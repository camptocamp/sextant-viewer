import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapLayer } from '../layer.utils'

const mocks = vi.hoisted(() => ({ getLayerByName: vi.fn(), fetchRecordResources: vi.fn() }))

vi.mock('@camptocamp/ogc-client', () => ({
  WmsEndpoint: class {
    isReady() {
      return Promise.resolve(this)
    }
    getLayerByName = mocks.getLayerByName
  },
}))
vi.mock('./gnRecord', () => ({ fetchRecordResources: mocks.fetchRecordResources }))

import { resolveWpsProcesses } from './detectWpsProcesses'

const SEXTANT_BASE = 'https://sextant.ifremer.fr/geonetwork'
const METADATA_URL = `${SEXTANT_BASE}/srv/fre/csw?request=GetRecordById&id=uuid-1`

const PROCESS = {
  url: 'https://host/services/wps/extraction',
  processId: 'script:surval-extraction',
  label: "Extraction des données d'observation",
}

const layer = (partial: Partial<Record<string, unknown>> = {}): MapLayer =>
  ({ type: 'wms', url: 'https://host/wms', name: 'surval', ...partial }) as MapLayer

function withMetadataUrl(url: string | null) {
  mocks.getLayerByName.mockReturnValue({
    metadata: url === null ? [] : [{ url, type: 'ISO19115:2003', format: 'text/xml' }],
  })
}

beforeEach(() => {
  mocks.getLayerByName.mockReset()
  mocks.fetchRecordResources.mockReset()
  mocks.fetchRecordResources.mockResolvedValue({ wfs: [], wps: [PROCESS] })
})

describe('resolveWpsProcesses', () => {
  it('resolves the processes without a single dataSource — the whole point of the decoupling', async () => {
    withMetadataUrl(METADATA_URL)
    expect(await resolveWpsProcesses(layer())).toEqual([PROCESS])
    expect(mocks.fetchRecordResources).toHaveBeenCalledWith(SEXTANT_BASE, 'uuid-1')
  })

  it('reads the record of the first sublayer of a comma-joined layer', async () => {
    withMetadataUrl(METADATA_URL)
    await resolveWpsProcesses(layer({ name: 'point, ligne' }))
    expect(mocks.getLayerByName).toHaveBeenCalledWith('point')
  })

  it('returns undefined for a layer with no MetadataURL', async () => {
    withMetadataUrl(null)
    expect(await resolveWpsProcesses(layer())).toBeUndefined()
    expect(mocks.fetchRecordResources).not.toHaveBeenCalled()
  })

  it('returns undefined when the MetadataURL has no /srv/ to truncate at', async () => {
    withMetadataUrl('https://host/catalogue/#/metadata/uuid-1')
    expect(await resolveWpsProcesses(layer())).toBeUndefined()
    expect(mocks.fetchRecordResources).not.toHaveBeenCalled()
  })

  it('returns undefined when the record declares no WPS resource', async () => {
    withMetadataUrl(METADATA_URL)
    mocks.fetchRecordResources.mockResolvedValue({ wfs: [], wps: [] })
    expect(await resolveWpsProcesses(layer())).toBeUndefined()
  })

  it('returns undefined for a layer missing its url or name', async () => {
    withMetadataUrl(METADATA_URL)
    expect(await resolveWpsProcesses(layer({ url: undefined }))).toBeUndefined()
    expect(await resolveWpsProcesses(layer({ name: undefined }))).toBeUndefined()
  })

  it('returns undefined for a non-WMS layer', async () => {
    expect(await resolveWpsProcesses({ type: 'geojson', url: 'https://host/x' } as MapLayer)).toBe(
      undefined,
    )
  })

  it('absorbs an unreachable record rather than rejecting', async () => {
    withMetadataUrl(METADATA_URL)
    mocks.fetchRecordResources.mockRejectedValue(new Error('offline'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await resolveWpsProcesses(layer())).toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
