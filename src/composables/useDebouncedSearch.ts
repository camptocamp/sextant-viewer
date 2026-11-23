import { computed, ref } from 'vue'
import { refDebounced } from '@vueuse/core'

// Debounced so typing doesn't send one index query per keystroke.
const SEARCH_DEBOUNCE_MS = 300

/**
 * A search input's text (`search`, bound to the input) and the term to query once typing pauses
 * (`term`, trimmed).
 */
export function useDebouncedSearch() {
  const search = ref('')
  const debounced = refDebounced(search, SEARCH_DEBOUNCE_MS)
  const term = computed(() => debounced.value.trim())
  return { search, term }
}
