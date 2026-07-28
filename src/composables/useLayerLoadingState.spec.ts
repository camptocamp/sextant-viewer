import { describe, expect, it } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import Collection from 'ol/Collection'
import type BaseLayer from 'ol/layer/Base'
import ImageLayer from 'ol/layer/Image'
import TileLayer from 'ol/layer/Tile'
import ImageWMS from 'ol/source/ImageWMS'
import TileWMS from 'ol/source/TileWMS'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import { useLayerLoadingState } from './useLayerLoadingState'

const imageWmsLayer = () =>
  new ImageLayer({ source: new ImageWMS({ url: '/wms', params: { LAYERS: 'a' } }) })
const tileWmsLayer = () =>
  new TileLayer({ source: new TileWMS({ url: '/wms', params: { LAYERS: 'a' } }) })

// A fake map exposing only what the composable touches: getLayers().
function mapWith(layers: BaseLayer[]) {
  const collection = new Collection<BaseLayer>(layers)
  const map = { getLayers: () => collection } as unknown as Map
  return { map, collection }
}

function run(map: Map) {
  const scope = effectScope()
  const isLoading = scope.run(() => useLayerLoadingState(shallowRef(map)).isLoading)!
  return { isLoading, stop: () => scope.stop() }
}

// Single-image WMS (`useTiles: false`) is what attribute-filter re-requests go through; tile WMS
// emits the equivalent tile* events. Both drive the same pending counter.
const sourceKinds = [
  {
    kind: 'single-image',
    layer: imageWmsLayer,
    start: 'imageloadstart',
    end: 'imageloadend',
    error: 'imageloaderror',
  },
  {
    kind: 'tile',
    layer: tileWmsLayer,
    start: 'tileloadstart',
    end: 'tileloadend',
    error: 'tileloaderror',
  },
] as const

describe.each(sourceKinds)('useLayerLoadingState — $kind WMS', ({ layer, start, end, error }) => {
  // Mounts a map holding one layer of the kind under test and exposes its source.
  function setup() {
    const wmsLayer = layer()
    const { map } = mapWith([wmsLayer])
    return { source: wmsLayer.getSource()!, ...run(map) }
  }

  it('is not loading initially', () => {
    const { isLoading } = setup()
    expect(isLoading.value).toBe(false)
  })

  it('tracks the load lifecycle', () => {
    const { source, isLoading } = setup()

    source.dispatchEvent(start)
    expect(isLoading.value).toBe(true)

    source.dispatchEvent(end)
    expect(isLoading.value).toBe(false)
  })

  it('clears loading on load error', () => {
    const { source, isLoading } = setup()

    source.dispatchEvent(start)
    source.dispatchEvent(error)
    expect(isLoading.value).toBe(false)
  })

  it('stays loading until every in-flight request settles', () => {
    const { source, isLoading } = setup()

    source.dispatchEvent(start)
    source.dispatchEvent(start)
    source.dispatchEvent(end)
    expect(isLoading.value).toBe(true)
    source.dispatchEvent(end)
    expect(isLoading.value).toBe(false)
  })
})

describe('useLayerLoadingState', () => {
  it('tracks layers added after setup', () => {
    const { map, collection } = mapWith([])
    const { isLoading } = run(map)

    const layer = imageWmsLayer()
    collection.push(layer)
    layer.getSource()!.dispatchEvent('imageloadstart')
    expect(isLoading.value).toBe(true)
  })

  it('ignores layers without a tile/image source', () => {
    const layer = new VectorLayer({ source: new VectorSource() })
    const { map } = mapWith([layer])
    const { isLoading } = run(map)
    expect(isLoading.value).toBe(false)
  })
})
