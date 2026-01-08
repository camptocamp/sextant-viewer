import { ref, type ComputedRef } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useMapStore } from '@/stores/map.store'

export function useLayerReordering(dataLayers: ComputedRef<MapContextLayer[]>) {
  const mapStore = useMapStore()
  const sortableRef = ref<HTMLElement | null>(null)
  const isDragging = ref(false)

  const handleReorder = (oldIndex: number, newIndex: number): void => {
    if (oldIndex === newIndex) return

    const delta = oldIndex - newIndex
    const draggedLayer = dataLayers.value[oldIndex]
    if (!draggedLayer) return

    mapStore.changeLayerPosition(draggedLayer, delta)
  }

  useSortable(sortableRef, dataLayers, {
    animation: 200,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onStart: () => {
      isDragging.value = true
    },
    onEnd: (evt) => {
      isDragging.value = false
      if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
        handleReorder(evt.oldIndex, evt.newIndex)
      }
    },
  })

  return {
    sortableRef,
    isDragging,
  }
}
