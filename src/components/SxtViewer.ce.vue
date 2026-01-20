<script setup lang="ts">
import LayoutGrid from '@/components/layout/LayoutGrid.vue'
import { onMounted, ref } from 'vue'

const containerRef = ref<HTMLElement | null>(null)

// This will copy the nuxt-ui-colors style tag into the shadow DOM of the custom element
onMounted(() => {
  const shadowDom = containerRef.value?.parentNode as ShadowRoot
  const shadowDomStyle = document.createElement('style')
  const nuxtUiColors = document.querySelector('[data-nuxt-ui-colors]') as HTMLStyleElement
  shadowDomStyle.innerText = nuxtUiColors.innerText
  shadowDom.insertBefore(shadowDomStyle, containerRef.value)
})
</script>

<template>
  <div class="relative isolate" ref="containerRef">
    <UApp>
      <MapViewer />
      <LayoutGrid />
    </UApp>
  </div>
</template>
