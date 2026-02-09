import { watchEffect, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useMapStore, type ExtendedMapContext } from '@/stores/map.store'
import { defineStore, storeToRefs } from 'pinia'
import { type Extent } from '@geospatial-sdk/core'

const SESSION_STORAGE_CONTEXT_KEY = 'sxt-viewer-current-map-context'

/**
 * Store for managing persistent map context in sessionStorage
 */
export const usePersistentContextStore = defineStore('persistentContext', () => {
  const { initialEnrichedContext, context, currentExtent } = storeToRefs(useMapStore())
  const { setContext } = useMapStore()

  // the first context change should be ignored as it is the initial context
  let ignoreNextContextChange = true

  // apply any saved context present
  const sessionContext = sessionStorage.getItem(SESSION_STORAGE_CONTEXT_KEY)
  if (sessionContext) {
    setContext(JSON.parse(sessionContext))
    ignoreNextContextChange = false // because we loaded the session context, we should allow reverting to the initial on
  }

  const canRestoreContext = ref<boolean>(false)

  const saveContextToStorage = useDebounceFn(
    (context: ExtendedMapContext, extent: Extent | null) => {
      if (ignoreNextContextChange) {
        ignoreNextContextChange = false
        return
      }
      const ctx = { ...context }
      if (extent) {
        ctx.view = {
          extent,
        }
      }
      sessionStorage.setItem(SESSION_STORAGE_CONTEXT_KEY, JSON.stringify(ctx))
      canRestoreContext.value = true
    },
    500,
  )

  const restoreContext = () => {
    ignoreNextContextChange = true // the next context change tick should be ignored as well
    currentExtent.value = null
    context.value = {
      ...initialEnrichedContext.value,
      view: { ...initialEnrichedContext.value.view },
    }
    canRestoreContext.value = false
    sessionStorage.removeItem(SESSION_STORAGE_CONTEXT_KEY)
  }

  // Set context once initialEnrichedContext is ready
  watch(
    initialEnrichedContext,
    (enriched) => {
      if (enriched && !sessionContext) {
        ignoreNextContextChange = true
        setContext(enriched)
      }
    },
    { immediate: true },
  )

  // Persist context changes to sessionStorage
  watchEffect(() => {
    saveContextToStorage(context.value, currentExtent.value)
  })

  return {
    canRestoreContext,
    restoreContext,
  }
})
