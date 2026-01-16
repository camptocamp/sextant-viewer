<script setup lang="ts">
import { ref } from 'vue'
import { useResizableDivider } from '@/composables/useResizableDivider'

defineProps<{
  showSubdivision?: boolean
}>()

const emit = defineEmits<{
  closePanel: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const { subdivisionHeightPercent, isDragging, onDividerMouseDown } =
  useResizableDivider(containerRef)

const handleClose = () => {
  emit('closePanel')
}
</script>

<template>
  <div ref="containerRef" class="flex h-full flex-col">
    <div class="flex-1 overflow-auto">
      <slot name="default" />
    </div>

    <template v-if="showSubdivision">
      <div class="mt-2 flex cursor-ns-resize items-center" @mousedown="onDividerMouseDown">
        <UBadge variant="solid" color="primary" size="md">Informations de la couche</UBadge>
        <div
          class="border-primary-200 grow-1 border-t-2"
          :class="{
            'border-primary-300': isDragging,
          }"
        ></div>
        <UButton
          icon="i-heroicons-x-mark"
          color="primary"
          variant="outline"
          size="xs"
          @click="handleClose"
          @mousedown.stop
        />
      </div>

      <!-- Subdivision content -->
      <div class="overflow-auto" :style="{ height: `${subdivisionHeightPercent}%` }">
        <slot name="subdivision" />
      </div>
    </template>
  </div>
</template>
