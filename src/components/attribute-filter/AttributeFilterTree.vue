<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { TreeItem } from '@nuxt/ui'
import UTree from '@nuxt/ui/components/Tree.vue'
import type { FieldValue, TreeIndexField } from '@/utils/geonetwork-index'
import {
  buildPathTree,
  isWithin,
  parentPath,
  type PathTreeNode,
} from '@/utils/geonetwork-index/pathTree'
import AttributeFilterSection from './AttributeFilterSection.vue'

const props = defineProps<{
  field: TreeIndexField
  values: readonly FieldValue[]
  truncated: boolean
  selected: readonly string[]
  expanded: readonly string[]
  searching: boolean
}>()

const emit = defineEmits<{
  toggle: [path: string]
  search: [term: string]
  'update:expanded': [paths: string[]]
}>()

interface PathTreeItem extends TreeItem {
  path: string
  count?: number
  children?: PathTreeItem[]
}

const search = ref('')
// Debounced so typing doesn't send one index query per keystroke.
const debouncedSearch = refDebounced(search, 300)
const searchTerm = computed(() => debouncedSearch.value.trim())

watch(searchTerm, (term) => emit('search', term))

const nodes = computed(() =>
  buildPathTree(props.values, (path) => {
    // Search matches come with their ancestors; otherwise the fetch covers the visible levels
    // plus one, which tells whether each visible node has children.
    if (searchTerm.value) return true
    const parent = parentPath(path)
    return parent === undefined || props.expanded.includes(parent)
  }),
)

const toItem = (node: PathTreeNode): PathTreeItem => ({
  label: node.label,
  path: node.path,
  count: node.count,
  children: node.children?.length ? node.children.map(toItem) : undefined,
})

const items = computed(() => nodes.value.map(toItem))

function parentsOf(list: PathTreeItem[]): string[] {
  return list.flatMap((item) => (item.children ? [item.path, ...parentsOf(item.children)] : []))
}

// Search results show fully expanded, without touching the browsing state kept by the composable.
const searchExpanded = ref<string[]>([])
watch(items, (list) => {
  if (searchTerm.value) searchExpanded.value = parentsOf(list)
})

const expandedModel = computed({
  get: () => (searchTerm.value ? searchExpanded.value : [...props.expanded]),
  set: (paths: string[]) => {
    if (searchTerm.value) searchExpanded.value = paths
    else emit('update:expanded', paths)
  },
})

const hasSelectedAncestor = (path: string) =>
  props.selected.some((selected) => selected !== path && isWithin(path, selected))

function checkState(path: string): boolean | 'indeterminate' {
  if (props.selected.includes(path) || hasSelectedAncestor(path)) return true
  return props.selected.some((selected) => isWithin(selected, path)) ? 'indeterminate' : false
}
</script>

<template>
  <AttributeFilterSection :label="field.label" :active-count="selected.length">
    <UInput
      v-model="search"
      :loading="searching"
      size="xs"
      icon="i-heroicons-magnifying-glass"
      placeholder="Rechercher une valeur"
      @keydown.stop
    />

    <div class="max-h-72 overflow-y-auto">
      <UTree
        v-model:expanded="expandedModel"
        :items="items"
        :get-key="(item) => item.path"
        size="sm"
        :ui="{ linkLabel: 'flex min-w-0 grow items-center gap-2' }"
        @select="(event) => event.preventDefault()"
      >
        <template #item-leading="{ item }">
          <!-- The row toggles expansion; only the checkbox selects. -->
          <span class="flex" @click.stop @keydown.stop>
            <UCheckbox
              :model-value="checkState(item.path)"
              :disabled="hasSelectedAncestor(item.path)"
              @update:model-value="emit('toggle', item.path)"
            />
          </span>
        </template>
        <template #item-label="{ item }">
          <span class="grow truncate text-left" :title="item.path">{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="text-muted shrink-0 text-xs">
            {{ item.count }}
          </span>
        </template>
      </UTree>

      <p v-if="items.length === 0" class="text-muted text-xs">Aucune valeur</p>
    </div>

    <p v-if="truncated" class="text-dimmed text-xs">
      Liste limitée à {{ values.length }} valeurs — affinez la recherche.
    </p>
  </AttributeFilterSection>
</template>
