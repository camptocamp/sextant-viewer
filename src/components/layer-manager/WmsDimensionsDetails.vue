<script setup lang="ts">
import { computed } from 'vue'
import {
  getDimensionOptions,
  getDimensionUnitLabel,
  getWmsOtherDimensions,
} from '@/utils/wms.utils'
import type { MapLayer } from '@/utils/layer.utils'
import WmsDimensionField from '@/components/layer-manager/WmsDimensionField.vue'

const props = defineProps<{ layer: MapLayer }>()

const dimensions = computed(() =>
  // hide single-value dimensions (e.g. reference_time with one option) — nothing to choose
  getWmsOtherDimensions(props.layer).filter((dim) => getDimensionOptions(dim).length > 1),
)
</script>

<template>
  <WmsDimensionField
    v-for="dim in dimensions"
    :key="dim.name"
    :layer="layer"
    :dimension-name="dim.name"
    :units="getDimensionUnitLabel(dim)"
  />
</template>
