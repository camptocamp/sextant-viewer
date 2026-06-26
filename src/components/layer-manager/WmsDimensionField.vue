<script setup lang="ts">
import { useWmsDimension } from '@/composables/useWmsDimension'
import type { MapLayer } from '@/utils/layer.utils'

const props = defineProps<{ layer: MapLayer; dimensionName: string; units?: string }>()

const { options, value, reset } = useWmsDimension(() => props.layer, props.dimensionName)

const label = props.units ? `${props.dimensionName} (${props.units})` : props.dimensionName
</script>

<template>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <span class="shrink-0 text-sm">{{ label }}&nbsp;:</span>
    <USelect v-model="value" :items="options" size="sm" :aria-label="dimensionName" />
    <UButton size="sm" color="neutral" variant="soft" @click="reset">Réinitialiser</UButton>
  </div>
</template>
