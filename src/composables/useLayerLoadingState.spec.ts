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

describe('useLayerLoadingState', () => {
  it('is not loading initially', () => {
    const { map } = mapWith([imageWmsLayer()])
    const { isLoading } = run(map)
    expect(isLoading.value).toBe(false)
  })

  it('tracks single-image WMS load lifecycle (filter re-requests go through here)', () => {
    const layer = imageWmsLayer()
    const { map } = mapWith([layer])
    const { isLoading } = run(map)

    layer.getSource()!.dispatchEvent('imageloadstart')
    expect(isLoading.value).toBe(true)

    layer.getSource()!.dispatchEvent('imageloadend')
    expect(isLoading.value).toBe(false)
  })

  it('clears loading on image load error', () => {
    const layer = imageWmsLayer()
    const { map } = mapWith([layer])
    const { isLoading } = run(map)

    layer.getSource()!.dispatchEvent('imageloadstart')
    layer.getSource()!.dispatchEvent('imageloaderror')
    expect(isLoading.value).toBe(false)
  })

  it('tracks tile WMS load lifecycle', () => {
    const layer = tileWmsLayer()
    const { map } = mapWith([layer])
    const { isLoading } = run(map)

    layer.getSource()!.dispatchEvent('tileloadstart')
    expect(isLoading.value).toBe(true)
    layer.getSource()!.dispatchEvent('tileloadend')
    expect(isLoading.value).toBe(false)
  })

  it('stays loading until every in-flight request settles', () => {
    const layer = imageWmsLayer()
    const { map } = mapWith([layer])
    const { isLoading } = run(map)
    const source = layer.getSource()!

    source.dispatchEvent('imageloadstart')
    source.dispatchEvent('imageloadstart')
    source.dispatchEvent('imageloadend')
    expect(isLoading.value).toBe(true)
    source.dispatchEvent('imageloadend')
    expect(isLoading.value).toBe(false)
  })

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
