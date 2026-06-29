<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { createLegendFromLayer } from '@geospatial-sdk/legend'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'

const props = defineProps<{
  layer: MapLayer
}>()

const container = ref<HTMLDivElement | null>(null)

let currentLayer: MapLayer | null = null

async function loadLegend(layer: MapLayer) {
  currentLayer = layer
  if (!container.value) return

  container.value.innerHTML = ''

  try {
    const element = await createLegendFromLayer(layer as MapContextLayer)

    // Ensure that the layer hasn't changed while the legend was being loaded
    if (layer !== currentLayer || !container.value) return

    if (element) {
      container.value.appendChild(element)
    }
  } catch (error) {
    console.error('Failed to load legend:', error)
  }
}

onMounted(() => loadLegend(props.layer))
watch(
  () => props.layer.id,
  () => loadLegend(props.layer),
)
</script>

<template>
  <div ref="container" />
</template>
