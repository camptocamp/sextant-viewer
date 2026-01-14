import { ref, computed } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useMapStore } from '@/stores/map.store'
import { isBasemapLayer } from '@/utils/layer.utils'

export function useLayerReordering() {
  const mapStore = useMapStore()

  const dataLayers = computed(() => {
    const filtered = mapStore.layers.filter((layer) => !isBasemapLayer(layer))
    return [...filtered].reverse()
  })

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
    dataLayers,
    sortableRef,
    isDragging,
  }
}
