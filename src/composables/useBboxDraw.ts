import { onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Extent } from '@geospatial-sdk/core'
import Feature from 'ol/Feature'
import type OlMap from 'ol/Map'
import { always } from 'ol/events/condition'
import { fromExtent } from 'ol/geom/Polygon'
import DragBox from 'ol/interaction/DragBox'
import VectorLayer from 'ol/layer/Vector'
import { transformExtent } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style } from 'ol/style'
import { useMapStore } from '@/stores/map.store'

const LON_LAT = 'EPSG:4326'
const COORDINATE_DECIMALS = 4

const AREA_STYLE = new Style({
  stroke: new Stroke({ color: '#ef4444', width: 2 }),
  fill: new Fill({ color: 'rgba(239, 68, 68, 0.08)' }),
})

const round = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS))

/**
 * Draw a geographic area on the map and outline the current one. Both go straight to OpenLayers:
 * a drawing interaction and its outline are transient UI, not map state the MapContext holds.
 *
 * @param area - The area to outline, EPSG:4326.
 * @param onDrawn - Receives each drawn area, EPSG:4326, rounded to 4 decimals.
 */
export function useBboxDraw(
  area: MaybeRefOrGetter<Extent | undefined>,
  onDrawn: (extent: Extent) => void,
) {
  const mapStore = useMapStore()
  const drawing = ref(false)

  const source = new VectorSource()
  const outline = new VectorLayer({ source, style: AREA_STYLE, zIndex: Infinity })
  let dragBox: DragBox | null = null

  const projectionOf = (map: OlMap) => map.getView().getProjection()

  watch(
    [() => mapStore.olMap, () => toValue(area)],
    ([map, extent], [previousMap]) => {
      if (previousMap && previousMap !== map) previousMap.removeLayer(outline)
      source.clear()
      if (!map) return
      if (!map.getLayers().getArray().includes(outline)) map.addLayer(outline)
      if (extent) {
        const projected = transformExtent(extent, LON_LAT, projectionOf(map))
        source.addFeature(new Feature(fromExtent(projected)))
      }
    },
    { immediate: true },
  )

  function stopDrawing() {
    if (dragBox) mapStore.olMap?.removeInteraction(dragBox)
    dragBox = null
    drawing.value = false
  }

  function startDrawing() {
    const map = mapStore.olMap
    if (!map || dragBox) return
    // Without a modifier key: the user asked to draw, so a drag draws instead of panning.
    const box = new DragBox({ condition: always })
    box.on('boxend', () => {
      const extent = transformExtent(box.getGeometry().getExtent(), projectionOf(map), LON_LAT)
      stopDrawing()
      onDrawn(extent.map(round) as Extent)
    })
    map.addInteraction(box)
    dragBox = box
    drawing.value = true
  }

  function toggleDrawing() {
    if (drawing.value) stopDrawing()
    else startDrawing()
  }

  onScopeDispose(() => {
    stopDrawing()
    mapStore.olMap?.removeLayer(outline)
  })

  return { drawing: readonly(drawing), toggleDrawing }
}
