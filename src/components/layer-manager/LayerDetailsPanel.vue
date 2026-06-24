<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, isStacLayer } from '@/utils/layer.utils'
import { hasLegendSupport } from '@geospatial-sdk/legend'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import { getWmsTimeDimension } from '@/utils/wms.utils'
import type { MapLayerStac } from '@/types/stac.types'
import StacLayerDetails from '@/components/stac/StacLayerDetails.vue'
import WmsTimeDetails from '@/components/layer-manager/WmsTimeDetails.vue'
import LayerLegend from '@/components/layer-manager/LayerLegend.vue'
import LayerSettings from '@/components/layer-manager/LayerSettings.vue'

const props = defineProps<{
  layer: MapLayer
}>()

const { canZoomToExtent, zoomToExtent, deleteLayer } = useLayerActions(() => props.layer)

const tabItems = computed(() => {
  const items = []
  if (hasLegendSupport(props.layer as MapContextLayer)) {
    items.push({
      slot: 'legend',
      value: 'legend',
      label: 'Légende',
    })
  }
  if (isStacLayer(props.layer)) {
    items.push({ slot: 'stac', value: 'stac', label: 'Données' })
  }
  items.push({ slot: 'settings', value: 'settings', label: 'Paramètres' })
  return items
})

const defaultTab = computed(() => tabItems.value[0]?.value)

const activeTab = ref<string | undefined>(defaultTab.value)
watch(
  () => props.layer.id,
  () => {
    if (tabItems.value.find((item) => item.value === activeTab.value)) return

    // Reset to default tab if the current active tab is not available for the new layer
    activeTab.value = defaultTab.value
  },
)
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>

    <WmsTimeDetails v-if="getWmsTimeDimension(layer)" :layer="layer" />

    <div class="mb-3 flex gap-2">
      <UButton
        icon="i-heroicons-arrows-pointing-out"
        color="primary"
        variant="soft"
        size="sm"
        :disabled="!canZoomToExtent"
        @click="zoomToExtent"
      >
        Zoomer sur l'étendue
      </UButton>
      <UButton icon="i-heroicons-trash" color="error" variant="soft" size="sm" @click="deleteLayer">
        Supprimer
      </UButton>
    </div>

    <UTabs v-model="activeTab" :items="tabItems" :ui="{ content: 'p-3 h-full' }">
      <template #legend>
        <LayerLegend :layer="layer" />
      </template>

      <template #stac>
        <StacLayerDetails :layer="layer as MapLayerStac" />
      </template>

      <template #settings>
        <LayerSettings :layer="layer" />
      </template>
    </UTabs>
  </div>
</template>
