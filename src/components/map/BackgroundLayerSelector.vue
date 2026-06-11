<script setup lang="ts">
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useMapStore } from '@/stores/map.store'
import { getLayerLabel } from '@/utils/layer.utils'

const mapStore = useMapStore()

const items = computed<DropdownMenuItem[][]>(() => [
  mapStore.backgroundLayers.map((layer) => ({
    type: 'checkbox',
    label: getLayerLabel(layer),
    checked: !!layer.visibility,
    class: 'cursor-pointer',
    onSelect: () => mapStore.selectBackgroundLayer(String(layer.id)),
  })),
])
</script>

<template>
  <UDropdownMenu :items="items">
    <UTooltip text="Fond de plan" :ignore-non-keyboard-focus="true">
      <UButton
        class="h-5.5 w-5.5 rounded-xs"
        icon="i-tabler-stack-2"
        color="neutral"
        variant="soft"
        size="xs"
        :square="true"
        :block="true"
        aria-label="Sélecteur de fond de plan"
      />
    </UTooltip>
  </UDropdownMenu>
</template>
