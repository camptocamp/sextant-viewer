<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { applyContextDiffToMap, createMapFromContext, listen } from '@geospatial-sdk/openlayers'
import {
  computeMapContextDiff,
  type MapContext,
  type MapExtentChangeEvent,
} from '@geospatial-sdk/core'
import type Map from 'ol/Map'
import { useStacLayer } from '@/composables/useStacLayer'
import { isStacLayer } from '@/utils/layer.utils'
import ResetExtentButton from './ResetExtentButton.vue'
import type { Extent } from 'ol/extent'

const { enrichStacLayer } = useStacLayer()
const mapStore = useMapStore()
const { sdkContext } = storeToRefs(mapStore)

const mapContainer = ref<HTMLElement | undefined>()
let map: Map | null = null

const emit = defineEmits<{
  'map-ready': [map: Map]
}>()

onMounted(async () => {
  if (!mapContainer.value) return
  map = await createMapFromContext(sdkContext.value, mapContainer.value)

  if (map) {
    emit('map-ready', map)
    listen(map, 'map-extent-change', (event: MapExtentChangeEvent) => {
      mapStore.setCurrentViewExtent(event.extent as Extent)
    })
  }
})

watch(
  sdkContext,
  (newContext: MapContext, oldContext: MapContext) => {
    if (!map) return

    const diff = computeMapContextDiff(newContext, oldContext)
    applyContextDiffToMap(map, diff)
  },
  { deep: false },
)

watch(
  () => mapStore.context.layers.filter(isStacLayer),
  (stacLayers) => {
    stacLayers.forEach((layer) => enrichStacLayer(layer))
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (map) {
    map.setTarget(undefined)
    map.dispose()
    map = null
  }
})
</script>

<template>
  <div ref="mapContainer" class="relative h-full w-full"></div>
  <ResetExtentButton class="absolute top-15 right-[.5em]" />
</template>

<style scoped></style>
