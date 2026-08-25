import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMapStore } from './map.store'

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
