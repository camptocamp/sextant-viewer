<script setup lang="ts">
import { computed } from 'vue'
import { useNcwmsLayer } from '@/composables/useNcwmsLayer'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'

const props = defineProps<{ layer: MapLayer }>()

const mapStore = useMapStore()
const { ncwmsInfo, palette, logScale, colorScaleRange, autoColorRange } = useNcwmsLayer(
  () => props.layer,
)

const paletteOptions = computed(() =>
  (ncwmsInfo.value?.palettes ?? []).map((p: string) => ({ label: p, value: p })),
)

async function onAutoColorRange() {
  if (!mapStore.currentExtent) return
  await autoColorRange(mapStore.currentExtent as [number, number, number, number])
}
</script>

<template>
  <div class="mb-3 flex flex-col gap-3">
    <UFormField label="Palette">
      <USelect
        v-model="palette"
        :items="paletteOptions"
        size="sm"
        class="w-full"
        :ui="{ content: 'z-50' }"
      />
    </UFormField>

    <div class="flex items-center gap-2">
      <USwitch v-model="logScale" size="sm" />
      <span class="text-sm">Échelle logarithmique</span>
    </div>

    <UFormField label="Plage de couleur">
      <div class="flex items-center gap-2">
        <UInput
          :model-value="colorScaleRange[0]"
          type="number"
          size="sm"
          class="w-24"
          @update:model-value="colorScaleRange = [Number($event), colorScaleRange[1]]"
        />
        <span class="text-sm text-gray-400">–</span>
        <UInput
          :model-value="colorScaleRange[1]"
          type="number"
          size="sm"
          class="w-24"
          @update:model-value="colorScaleRange = [colorScaleRange[0], Number($event)]"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          icon="i-lucide-sparkles"
          :disabled="!mapStore.currentExtent"
          @click="onAutoColorRange"
        >
          Auto
        </UButton>
      </div>
    </UFormField>
  </div>
</template>
