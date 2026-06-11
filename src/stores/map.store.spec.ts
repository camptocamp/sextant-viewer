import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'

vi.mock('uuid', () => ({ v4: () => 'generated-uuid' }))
vi.mock('@/utils/legend.utils', () => ({ resolveLegendUrl: vi.fn() }))
vi.mock('@/utils/stac.utils', () => ({ enrichStacLayer: vi.fn() }))

import { useMapStore } from '@/stores/map.store'
import { resolveLegendUrl } from '@/utils/legend.utils'
import { enrichStacLayer } from '@/utils/stac.utils'

const resolveLegendUrlMock = vi.mocked(resolveLegendUrl)
const enrichStacLayerMock = vi.mocked(enrichStacLayer)

function layer(overrides: Partial<MapLayer> = {}): MapLayer {
  return { type: 'geojson', ...overrides } as MapLayer
}

const VIEW: MapContextView = { center: [0, 0], zoom: 1 }

function ctx(layers: MapLayer[], view: MapContextView = VIEW) {
  return { view, layers }
}

describe('map.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resolveLegendUrlMock.mockReset().mockResolvedValue(undefined)
    enrichStacLayerMock.mockReset().mockResolvedValue(undefined)
  })

  describe('initial state', () => {
    it('exposes the default context and derived state', () => {
      // When the store is created
      const store = useMapStore()

      // Then the context, derived layers/view and extent reflect the defaults
      expect(store.context).toEqual(store.initialContext)
      expect(store.layers).toEqual(store.context.layers)
      expect(store.view).toEqual(store.context.view)
      expect(store.currentExtent).toBeNull()
    })
  })

  describe('sdkContext', () => {
    it('drops STAC layers without data, converts those with data, passes others through', () => {
      // Given a context mixing a normal layer with empty and populated STAC layers
      const store = useMapStore()
      const normal = layer({ type: 'wms', id: 'wms-1', name: 'n', url: 'http://x' })
      const stacNoData = { type: 'stac', id: 's-empty', url: 'http://s' } as unknown as MapLayer
      const stacWithData = {
        type: 'stac',
        id: 's-full',
        url: 'http://s',
        label: 'STAC',
        opacity: 0.5,
        data: { type: 'FeatureCollection', features: [] },
      } as unknown as MapLayer
      store.context = ctx([normal, stacNoData, stacWithData])

      // When the SDK context is derived
      const ids = store.sdkContext.layers.map((l) => (l as { id?: string }).id)
      const converted = store.sdkContext.layers.find((l) => (l as { id?: string }).id === 's-full')

      // Then the empty STAC layer is dropped and the populated one is converted to geojson
      expect(ids).toEqual(['wms-1', 's-full'])
      expect(converted).toMatchObject({ type: 'geojson', id: 's-full', opacity: 0.5 })
    })
  })

  describe('enrichLayer (via addLayer)', () => {
    it('generates an id and defaults version for a plain layer', async () => {
      // Given a store and a layer with no id or version
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer(layer())

      // Then an id is generated and the version defaults to 0
      expect(enriched.id).toBe('generated-uuid')
      expect(enriched.version).toBe(0)
    })

    it('keeps an existing id and version', async () => {
      // Given a layer that already has an id and version
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer(layer({ id: 'g1', version: 5 }))

      // Then both are preserved
      expect(enriched.id).toBe('g1')
      expect(enriched.version).toBe(5)
    })

    it('treats an empty id as missing and preserves version 0', async () => {
      // Given a layer with an empty id and an explicit version of 0
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer(layer({ id: '', version: 0 }))

      // Then an id is generated while version 0 is kept
      expect(enriched.id).toBe('generated-uuid')
      expect(enriched.version).toBe(0)
    })

    it('resolves a legend URL for layers with legend support, merging extras', async () => {
      // Given a WMS layer with existing extras and a resolvable legend URL
      resolveLegendUrlMock.mockResolvedValue('http://legend.png')
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer(
        layer({ type: 'wms', id: 'w1', name: 'n', url: 'http://x', extras: { foo: 'bar' } }),
      )

      // Then the legend URL is resolved and merged into the existing extras
      expect(resolveLegendUrlMock).toHaveBeenCalledOnce()
      expect(enriched.extras).toEqual({ foo: 'bar', legendUrl: 'http://legend.png' })
    })

    it('enriches STAC layers through enrichStacLayer', async () => {
      // Given a STAC layer and an enrichment that returns a richer layer
      const stacInput = { type: 'stac', id: 's1', url: 'http://s' } as unknown as MapLayer
      const stacEnriched = { ...stacInput, label: 'enriched' } as MapLayerStac
      enrichStacLayerMock.mockResolvedValue(stacEnriched)
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer(stacInput)

      // Then the enriched STAC layer is used
      expect(enrichStacLayerMock).toHaveBeenCalledOnce()
      expect(enriched).toBe(stacEnriched)
    })

    it('falls back to the base layer when STAC enrichment returns undefined', async () => {
      // Given a STAC layer whose enrichment yields nothing
      enrichStacLayerMock.mockResolvedValue(undefined)
      const store = useMapStore()

      // When the layer is added
      const enriched = await store.addLayer({
        type: 'stac',
        url: 'http://s',
      } as unknown as MapLayer)

      // Then the base layer (with id/version applied) is kept
      expect(enriched.id).toBe('generated-uuid')
      expect(enriched.version).toBe(0)
    })
  })

  describe('setInitialContext', () => {
    it('stores the initial context without applying it by default', async () => {
      // Given a store and a new context
      const store = useMapStore()
      const before = store.context
      const initial = ctx([layer({ id: 'a' })], { center: [1, 1], zoom: 3 })

      // When the initial context is set without applying
      await store.setInitialContext(initial)

      // Then only the initial context changes
      expect(store.initialContext).toEqual(initial)
      expect(store.context).toBe(before)
    })

    it('applies the context when apply is true', async () => {
      // Given a store and a new context
      const store = useMapStore()
      const initial = ctx([layer({ id: 'a' })], { center: [1, 1], zoom: 3 })

      // When the initial context is set with apply enabled
      await store.setInitialContext(initial, true)

      // Then the active context reflects it
      expect(store.context.view).toEqual(initial.view)
      expect(store.context.layers[0]!.id).toBe('a')
    })
  })

  describe('setContext', () => {
    it('enriches layers and forces a fresh view object', async () => {
      // Given a context with a WMS layer and a resolvable legend URL
      resolveLegendUrlMock.mockResolvedValue('http://legend.png')
      const store = useMapStore()
      const view: MapContextView = { center: [2, 2], zoom: 4 }

      // When the context is set
      await store.setContext(
        ctx([layer({ type: 'wms', id: 'w1', name: 'n', url: 'http://x' })], view),
      )

      // Then the layers are enriched and the view is replaced with a fresh object
      expect(store.context.view).toEqual(view)
      expect(store.context.view).not.toBe(view)
      expect((store.context.layers[0]!.extras as { legendUrl?: string }).legendUrl).toBe(
        'http://legend.png',
      )
    })
  })

  describe('setView', () => {
    it('replaces the view immutably', () => {
      // Given a store with existing layers
      const store = useMapStore()
      const layers = store.context.layers

      // When a new view is set
      store.setView({ center: [5, 6], zoom: 9 })

      // Then the view changes while the layers reference is untouched
      expect(store.view).toEqual({ center: [5, 6], zoom: 9 })
      expect(store.context.layers).toBe(layers)
    })
  })

  describe('resetView', () => {
    it('restores the initial context view', async () => {
      // Given a store whose view has been changed
      const store = useMapStore()
      const initialView = { ...store.initialContext.view }
      store.setView({ center: [99, 99], zoom: 1 })

      // When the view is reset
      store.resetView()

      // Then it returns to the initial context view
      expect(store.view).toEqual(initialView)
    })

    it('falls back to the default view when the initial view is missing', async () => {
      // Given an initial context without a view
      const store = useMapStore()
      await store.setInitialContext({
        layers: [],
        view: undefined,
      } as unknown as Parameters<typeof store.setInitialContext>[0])

      // When the view is reset
      store.resetView()

      // Then the fallback view is applied
      expect(store.view).toEqual({ center: [0, 0], zoom: 2 })
    })
  })

  describe('setCurrentViewExtent', () => {
    it('stores the current extent', () => {
      // Given a store
      const store = useMapStore()

      // When the current extent is set
      store.setCurrentViewExtent([0, 0, 10, 10])

      // Then it is stored
      expect(store.currentExtent).toEqual([0, 0, 10, 10])
    })
  })

  describe('addLayer', () => {
    it('appends the enriched layer to the context', async () => {
      // Given a store with a known layer count
      const store = useMapStore()
      const initialCount = store.layers.length

      // When a layer is added
      await store.addLayer(layer({ id: 'a' }))

      // Then it is appended to the context
      expect(store.layers).toHaveLength(initialCount + 1)
      expect(store.layers[store.layers.length - 1]!.id).toBe('a')
    })
  })

  describe('deleteLayer', () => {
    it('removes a layer by identity', async () => {
      // Given a context with two layers
      const store = useMapStore()
      await store.setContext(ctx([layer({ id: 'a' }), layer({ id: 'b' })]))

      // When one layer is deleted
      store.deleteLayer(store.getLayerById('a')!)

      // Then only the other remains
      expect(store.layers.map((l) => l.id)).toEqual(['b'])
    })
  })

  describe('changeLayerPosition', () => {
    it('moves a layer by the given delta', async () => {
      // Given a context with three ordered layers
      const store = useMapStore()
      await store.setContext(ctx([layer({ id: 'a' }), layer({ id: 'b' }), layer({ id: 'c' })]))

      // When the last layer is moved up by one
      store.changeLayerPosition(store.getLayerById('c')!, -1)

      // Then the order reflects the move
      expect(store.layers.map((l) => l.id)).toEqual(['a', 'c', 'b'])
    })
  })

  describe('updateLayer', () => {
    it('applies partial updates and bumps the version', async () => {
      // Given a context with a single layer at version 0
      const store = useMapStore()
      await store.setContext(ctx([layer({ id: 'a', opacity: 1 })]))

      // When a partial update is applied
      store.updateLayer(store.getLayerById('a')!, { opacity: 0.5 })

      // Then the property changes and the version is bumped
      const updated = store.getLayerById('a')!
      expect(updated.opacity).toBe(0.5)
      expect(updated.version).toBe(1)
    })
  })

  describe('getLayerById', () => {
    it('returns the matching layer or undefined', async () => {
      // Given a context with one layer
      const store = useMapStore()
      await store.setContext(ctx([layer({ id: 'a' })]))

      // When looking layers up by id
      // Then a match is returned and a miss is undefined
      expect(store.getLayerById('a')?.id).toBe('a')
      expect(store.getLayerById('missing')).toBeUndefined()
    })
  })

  describe('fromStacToGeojsonLayer', () => {
    it('maps STAC fields and applies opacity/visibility defaults', () => {
      // Given a STAC layer without opacity or visibility
      const store = useMapStore()

      // When it is converted to a geojson layer
      const result = store.fromStacToGeojsonLayer({
        id: 's1',
        label: 'STAC',
        data: { type: 'FeatureCollection', features: [] },
      } as unknown as MapLayerStac)

      // Then fields are mapped and defaults applied
      expect(result).toMatchObject({
        type: 'geojson',
        id: 's1',
        label: 'STAC',
        opacity: 1,
        visibility: true,
      })
    })
  })
})
