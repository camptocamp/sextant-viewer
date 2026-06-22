<script setup lang="ts">
import { ref } from 'vue'
import { useAddLayer } from '@/composables/useAddLayer'

const emit = defineEmits<{ 'layer-added': [] }>()

const { addLayer } = useAddLayer()

const geojsonUrl = ref('')
const cogUrl = ref('')

const addGeojson = async () => {
  await addLayer(
    {
      type: 'geojson',
      url: geojsonUrl.value,
      label: 'Couche GeoJSON',
    },
    true,
  )
  geojsonUrl.value = ''
  emit('layer-added')
}

const addCog = async () => {
  await addLayer({ type: 'geotiff', url: cogUrl.value, label: 'Couche COG' }, true)
  cogUrl.value = ''
  emit('layer-added')
}
</script>

<template>
  <div class="flex flex-col gap-4 p-2">
    <UFormField label="Couche GeoJSON">
      <UFieldGroup class="w-full">
        <UInput v-model="geojsonUrl" placeholder="https://..." class="flex-1" />
        <UButton label="Ajouter" :disabled="!geojsonUrl" @click="addGeojson()" />
      </UFieldGroup>
    </UFormField>
    <UFormField label="Couche COG">
      <UFieldGroup class="w-full">
        <UInput v-model="cogUrl" placeholder="https://..." class="flex-1" />
        <UButton label="Ajouter" :disabled="!cogUrl" @click="addCog()" />
      </UFieldGroup>
    </UFormField>
  </div>
</template>
