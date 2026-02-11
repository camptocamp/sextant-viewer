import type { CollectionEvent } from 'ol/Collection'
import type BaseLayer from 'ol/layer/Base'
import type Layer from 'ol/layer/Layer'
import type Map from 'ol/Map'
import type TileSource from 'ol/source/Tile'
import { computed, onBeforeUnmount, ref, watch, type ShallowRef } from 'vue'

/**
 * Tracks whether any tile-based layer on the map is currently loading tiles.
 *
 * Works by listening to OpenLayers source events (tileloadstart / tileloadend /
 * tileloaderror) on every layer. A global pending counter is incremented on each
 * start and decremented on each end/error, so `isLoading` stays true as long as
 * at least one tile is still being fetched.
 *
 * Layers added after initial setup are automatically tracked via the map's
 * layers collection 'add' event.
 */
export function useLayerLoadingState(mapRef: ShallowRef<Map | null>) {
  // Number of tiles currently being fetched across all layers
  const pendingTileCount = ref(0)
  // Stores unsubscribe functions so we can clean up all listeners on unmount
  const cleanupFunctions: Array<() => void> = []

  const isLoading = computed(() => pendingTileCount.value > 0)

  /**
   * Hooks into a single layer's tile source events.
   * Silently skips layers that don't have a tile source (e.g. vector layers).
   */
  function attachSourceListeners(layer: BaseLayer) {
    // BaseLayer doesn't expose getSource(); cast needed for tile/image layers
    if (typeof (layer as Layer).getSource !== 'function') return

    const source = (layer as Layer).getSource() as TileSource | null
    if (!source || typeof source.on !== 'function') return

    const handleTileLoadStart = () => {
      pendingTileCount.value++
    }
    const handleTileLoadEnd = () => {
      if (pendingTileCount.value > 0) pendingTileCount.value--
    }

    // tileloaderror is treated the same as tileloadend to avoid the counter
    // getting stuck when a tile request fails
    source.on('tileloadstart', handleTileLoadStart)
    source.on('tileloadend', handleTileLoadEnd)
    source.on('tileloaderror', handleTileLoadEnd)

    cleanupFunctions.push(() => {
      source.un('tileloadstart', handleTileLoadStart)
      source.un('tileloadend', handleTileLoadEnd)
      source.un('tileloaderror', handleTileLoadEnd)
    })
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
