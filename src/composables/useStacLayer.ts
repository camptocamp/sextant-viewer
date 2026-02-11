import { type MapLayerStac, type StacFilters } from '@/types/stac.types'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { fetchPage, getStacLayerInfo } from '@/utils/stac.utils'

export function useStacLayer() {
  const mapStore = useMapStore()

  async function updateStacFilters(layer: MapLayerStac, filters: StacFilters) {
    const stacLayerInfo = await getStacLayerInfo(layer, filters)

    const updates: Partial<MapLayer> = {
      filters,
      data: stacLayerInfo.data,
      pagination: stacLayerInfo.pagination,
      version: (layer.version || 0) + 1,
    }
    mapStore.updateLayer(layer, updates)
  }

  async function loadNextPage(layer: MapLayerStac) {
    const stacLayerInfo = await fetchPage(layer, 'next')

    if (stacLayerInfo.pagination && stacLayerInfo.data) {
      const updates: Partial<typeof layer> = {
        data: stacLayerInfo.data,
        pagination: stacLayerInfo.pagination,
        version: (layer.version || 0) + 1,
      }
      mapStore.updateLayer(layer, updates)
    }
  }

  async function loadPreviousPage(layer: MapLayerStac) {
    const stacLayerInfo = await fetchPage(layer, 'previous')

    if (stacLayerInfo.pagination && stacLayerInfo.data) {
      const updates: Partial<typeof layer> = {
        data: stacLayerInfo.data,
        pagination: stacLayerInfo.pagination,
        version: (layer.version || 0) + 1,
      }
      mapStore.updateLayer(layer, updates)
    }
  }

  return {
    updateStacFilters,
    loadNextPage,
    loadPreviousPage,
  }
}
