<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'

const mapStore = useMapStore()

const handleClick = () => {
  mapStore.resetView()
}
</script>

<template>
  <UTooltip text="Retourner à l'étendue par défaut">
    <UButton
      class="mr-0.75 h-5.5 w-5.5 rounded-xs"
      icon="i-heroicons-globe-alt-16-solid"
      color="neutral"
      variant="soft"
      size="xs"
      :square="true"
      :block="true"
      aria-label="Retourner à l'étendue par défaut"
      @click="handleClick"
    />
  </UTooltip>
</template>
