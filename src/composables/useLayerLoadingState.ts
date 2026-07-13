import type { CollectionEvent } from 'ol/Collection'
import type BaseLayer from 'ol/layer/Base'
import type Layer from 'ol/layer/Layer'
import type Map from 'ol/Map'
import ImageSource from 'ol/source/Image'
import TileSource from 'ol/source/Tile'
import { computed, onBeforeUnmount, ref, watch, type ShallowRef } from 'vue'

/**
 * Tracks whether any layer on the map is currently loading imagery.
 *
 * Works by listening to OpenLayers source events on every layer: tile sources
 * emit tileloadstart/end/error, image sources (single-image WMS, i.e. `useTiles:
 * false`) emit imageloadstart/end/error. A global pending counter is incremented
 * on each start and decremented on each end/error, so `isLoading` stays true as
 * long as at least one request is in flight.
 *
 * Covering image sources is what ties attribute-filter changes to the loading
 * bar: applying a filter updates the WMS FILTER param via `source.updateParams`,
 * which re-requests the image and fires imageloadstart until the map redraws.
 *
 * Layers added after initial setup are automatically tracked via the map's
 * layers collection 'add' event.
 */
export function useLayerLoadingState(mapRef: ShallowRef<Map | null>) {
  // Number of tile/image requests currently in flight across all layers
  const pendingCount = ref(0)
  // Stores unsubscribe functions so we can clean up all listeners on unmount
  const cleanupFunctions: Array<() => void> = []

  const isLoading = computed(() => pendingCount.value > 0)

  /**
   * Hooks into a single layer's source load events.
   * Silently skips layers whose source is neither tile- nor image-based
   * (e.g. vector layers).
   */
  function attachSourceListeners(layer: BaseLayer) {
    // BaseLayer doesn't expose getSource(); cast needed for tile/image layers
    if (typeof (layer as Layer).getSource !== 'function') return

    const source = (layer as Layer).getSource()
    if (!source) return

    // Load-error events are treated like load-end to avoid the counter getting
    // stuck when a request fails.
    const onStart = () => {
      pendingCount.value++
    }
    const onEnd = () => {
      if (pendingCount.value > 0) pendingCount.value--
    }

    if (source instanceof TileSource) {
      source.on('tileloadstart', onStart)
      source.on('tileloadend', onEnd)
      source.on('tileloaderror', onEnd)
      cleanupFunctions.push(() => {
        source.un('tileloadstart', onStart)
        source.un('tileloadend', onEnd)
        source.un('tileloaderror', onEnd)
      })
    } else if (source instanceof ImageSource) {
      source.on('imageloadstart', onStart)
      source.on('imageloadend', onEnd)
      source.on('imageloaderror', onEnd)
      cleanupFunctions.push(() => {
        source.un('imageloadstart', onStart)
        source.un('imageloadend', onEnd)
        source.un('imageloaderror', onEnd)
      })
    }
  }

  /**
   * Attaches listeners to all existing layers and watches for new layers
   * being added to the map so they are tracked too.
   */
  function setupListeners(map: Map) {
    map.getLayers().forEach((layer) => attachSourceListeners(layer))

    const layersCollection = map.getLayers()
    const handleLayerAdd = (event: CollectionEvent<BaseLayer>) =>
      attachSourceListeners(event.element)
    layersCollection.on('add', handleLayerAdd)
    cleanupFunctions.push(() => layersCollection.un('add', handleLayerAdd))
  }

  // Wait for the map instance to become available, then wire everything up
  watch(
    () => mapRef.value,
    (map) => {
      if (map) setupListeners(map)
    },
    { immediate: true },
  )

  // Remove all OpenLayers event listeners when the component is destroyed
  onBeforeUnmount(() => {
    cleanupFunctions.forEach((fn) => fn())
    cleanupFunctions.length = 0
  })

  return { isLoading }
}
