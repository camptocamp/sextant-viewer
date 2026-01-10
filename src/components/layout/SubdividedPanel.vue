<script setup lang="ts">
import { ref } from 'vue'
import { useResizableDivider } from '@/composables/useResizableDivider'

defineProps<{
  showSubdivision?: boolean
}>()

const containerRef = ref<HTMLElement | null>(null)
const { subdivisionHeightPercent, isDragging, onDividerMouseDown } =
  useResizableDivider(containerRef)
</script>

<template>
  <div ref="containerRef" class="flex h-full flex-col">
    <!-- Main content area -->
    <div class="flex-1 overflow-auto">
      <slot name="default" />
    </div>

    <!-- Subdivision with draggable divider -->
    <template v-if="showSubdivision">
      <!-- Divider bar -->
      <div
        class="border-primary-200 mt-1 flex items-center justify-center border-t-2 pt-1 transition-colors select-none"
        :class="{
          'cursor-ns-resize': !isDragging,
          'border-primary-300': isDragging,
        }"
        @mousedown="onDividerMouseDown"
      ></div>

      <!-- Subdivision content -->
      <div class="overflow-auto" :style="{ height: `${subdivisionHeightPercent}%` }">
        <slot name="subdivision" />
      </div>
    </template>
  </div>
</template>
