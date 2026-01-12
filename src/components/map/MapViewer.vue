<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { applyContextDiffToMap, createMapFromContext } from '@geospatial-sdk/openlayers'
import { computeMapContextDiff, type MapContext } from '@geospatial-sdk/core'
import type Map from 'ol/Map'

const mapStore = useMapStore()
const { context } = storeToRefs(mapStore)

const mapContainer = ref<HTMLElement | undefined>()
let map: Map | null = null

onMounted(async () => {
  if (!mapContainer.value) return
  map = await createMapFromContext(context.value, mapContainer.value)
})

watch(
  context,
  (newContext: MapContext, oldContext: MapContext) => {
    if (!map) return

    const diff = computeMapContextDiff(newContext, oldContext)
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
