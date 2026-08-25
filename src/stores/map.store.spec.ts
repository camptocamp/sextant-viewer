import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { MapLayer } from '@/utils/layer.utils'

const mocks = vi.hoisted(() => ({
  resolveAttributeFilter: vi.fn(),
  resolveWpsProcesses: vi.fn(),
}))

vi.mock('@/utils/geonetwork-index', () => ({
  resolveAttributeFilter: mocks.resolveAttributeFilter,
  resolveWpsProcesses: mocks.resolveWpsProcesses,
}))

import { useMapStore } from './map.store'

const flush = () => new Promise((resolve) => setTimeout(resolve))

describe('map store — wpsServices', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes services declared through setContext', async () => {
    const store = useMapStore()
    await store.setContext({
      layers: [],
      backgroundLayers: [],
      view: { center: [0, 0], zoom: 2 },
      wpsServices: [{ url: 'https://host/wps', label: 'Host' }],
    })
    expect(store.wpsServices).toEqual([{ url: 'https://host/wps', label: 'Host' }])
  })

  it('round-trips services through getContext', async () => {
    const store = useMapStore()
    await store.setContext({
      layers: [],
      backgroundLayers: [],
      view: { center: [0, 0], zoom: 2 },
      wpsServices: [{ url: 'https://host/wps', label: 'Host' }],
    })
    expect(store.getContext().wpsServices).toEqual([{ url: 'https://host/wps', label: 'Host' }])
  })

  it('omits wpsServices from getContext when none are declared', () => {
    const store = useMapStore()
    expect(store.getContext().wpsServices).toBeUndefined()
  })
})

describe('map store — background detections', () => {
  const DATA_INDEX = { url: '/es', featureTypeIds: ['ft'] }
  const WPS_PROCESSES = [{ url: 'https://host/wps', processId: 'script:extract' }]

  const wmsLayer = (): MapLayer =>
    ({ type: 'wms', url: 'https://host/wms', name: 'surval' }) as MapLayer

  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.resolveAttributeFilter.mockReset().mockResolvedValue(undefined)
    mocks.resolveWpsProcesses.mockReset().mockResolvedValue(undefined)
  })

  it('stores the detected processes on the layer', async () => {
    mocks.resolveWpsProcesses.mockResolvedValue(WPS_PROCESSES)
    const store = useMapStore()
    const layer = await store.addLayer(wmsLayer())
    await flush()
    expect(store.getLayerById(layer.id!)?.extras?.wpsProcesses).toEqual(WPS_PROCESSES)
  })

  // The two detections are separate fire-and-forgets patching the same `extras`: whichever resolves
  // second must merge, not replace.
  it('keeps both keys when the two detections resolve concurrently', async () => {
    mocks.resolveAttributeFilter.mockResolvedValue(DATA_INDEX)
    mocks.resolveWpsProcesses.mockResolvedValue(WPS_PROCESSES)
    const store = useMapStore()
    const layer = await store.addLayer(wmsLayer())
    await flush()
    const extras = store.getLayerById(layer.id!)?.extras
    expect(extras?.dataIndex).toEqual(DATA_INDEX)
    expect(extras?.wpsProcesses).toEqual(WPS_PROCESSES)
  })

  it('leaves no empty key when nothing is detected', async () => {
    const store = useMapStore()
    const layer = await store.addLayer(wmsLayer())
    await flush()
    expect(store.getLayerById(layer.id!)?.extras?.wpsProcesses).toBeUndefined()
  })

  it('does not restore wpsProcesses through getContext — it is derived, and re-detected', async () => {
    mocks.resolveWpsProcesses.mockResolvedValue(WPS_PROCESSES)
    const store = useMapStore()
    await store.addLayer(wmsLayer())
    await flush()
    const [restored] = store.getContext().layers
    expect(restored!.extras?.wpsProcesses).toBeUndefined()
  })

  it('skips detection for a layer that already carries processes', async () => {
    const store = useMapStore()
    await store.addLayer({ ...wmsLayer(), extras: { wpsProcesses: WPS_PROCESSES } } as MapLayer)
    await flush()
    expect(mocks.resolveWpsProcesses).not.toHaveBeenCalled()
  })
})
