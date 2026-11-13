<script setup lang="ts">
defineProps<{
  label: string
  /** Number shown in the header badge; the badge is hidden when 0. */
  activeCount: number
}>()
</script>

<template>
  <UCollapsible class="border-default rounded border">
    <template #default="{ open }">
      <UButton variant="ghost" color="neutral" block class="justify-between font-medium">
        <span class="truncate">{{ label }}</span>
        <template #trailing>
          <UBadge v-if="activeCount" size="xs" color="primary" variant="soft">
            {{ activeCount }}
          </UBadge>
          <UIcon
            name="i-heroicons-chevron-down"
            class="transition-transform"
            :class="{ 'rotate-180': open }"
          />
        </template>
      </UButton>
    </template>

    <template #content>
      <div class="space-y-2 px-2 pb-2">
        <slot />
      </div>
    </template>
  </UCollapsible>
</template>
