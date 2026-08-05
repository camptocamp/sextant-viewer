<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { createLegendFromLayer } from '@geospatial-sdk/legend'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import { getNcwmsInfo } from '@/utils/ncwms.utils'
import { useNcwmsLayer } from '@/composables/useNcwmsLayer'

const props = defineProps<{
  layer: MapLayer
}>()

const isNcwms = computed(() => !!getNcwmsInfo(props.layer))
const { legendUrl: ncwmsLegendUrl } = useNcwmsLayer(() => props.layer)

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

onMounted(() => {
  if (!isNcwms.value) loadLegend(props.layer)
})
watch(
  () => [props.layer.id, isNcwms.value],
  () => {
    if (!isNcwms.value) loadLegend(props.layer)
  },
)
</script>

<template>
  <img v-if="isNcwms" :src="ncwmsLegendUrl" alt="Légende" class="self-start" />
  <div v-else ref="container" />
</template>
