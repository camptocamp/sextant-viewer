<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { applyContextDiffToMap, createMapFromContext } from '@geospatial-sdk/openlayers'
import { computeMapContextDiff, type MapContext } from '@geospatial-sdk/core'
import type Map from 'ol/Map'
import { until } from '@vueuse/core'

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
  }
})

watch(
  () => sdkContext.value,
  async (newContext: MapContext | undefined, oldContext: MapContext | undefined) => {
    console.log('Map context changed:', { newContext, oldContext })

    // Wait for new context to be defined
    if (!newContext) {
      await until(sdkContext).toBeTruthy()
      return
    }

    if (!map || !oldContext) return

    const diff = computeMapContextDiff(newContext, oldContext)
    console.log('Applying context diff to map:', diff)
    applyContextDiffToMap(map, diff)
  },
  { deep: false },
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
</template>

<style scoped></style>
