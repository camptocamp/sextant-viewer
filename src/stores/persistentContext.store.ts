import { watchEffect } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useMapStore, type ExtendedMapContext } from '@/stores/map.store'
import { defineStore, storeToRefs } from 'pinia'
import { type Extent } from '@geospatial-sdk/core'

const SESSION_STORAGE_INITIAL_CONTEXT_KEY = 'sxt-viewer-current-map-initial-context'
const SESSION_STORAGE_CONTEXT_KEY = 'sxt-viewer-current-map-context'

/**
 * Store for managing persistent map context in sessionStorage
 */
export const usePersistentContextStore = defineStore('persistentContext', () => {
  const { initialContext, context, currentExtent } = storeToRefs(useMapStore())
  const { setContext, setInitialContext, getContext } = useMapStore()

  // restore from sessionStorage do not need to be stored in sessionStorage
  let ignoreNextInitialContextChange = false
  let ignoreNextContextChange = false

  // apply any saved initial context present
  function restoreInitialContext() {
    const sessionInitialContext = sessionStorage.getItem(SESSION_STORAGE_INITIAL_CONTEXT_KEY)
    if (sessionInitialContext) {
      ignoreNextInitialContextChange = true
      setInitialContext(JSON.parse(sessionInitialContext))
      ignoreNextInitialContextChange = false
    }
  }
  restoreInitialContext()

  // apply any saved context present
  function restoreContext() {
    const sessionContext = sessionStorage.getItem(SESSION_STORAGE_CONTEXT_KEY)
    if (sessionContext) {
      ignoreNextContextChange = true
      setContext(JSON.parse(sessionContext))
      ignoreNextContextChange = false
    }
  }
  restoreContext()

  const saveInitialContextToStorage = useDebounceFn((initialContext: ExtendedMapContext) => {
    sessionStorage.setItem(SESSION_STORAGE_INITIAL_CONTEXT_KEY, JSON.stringify(initialContext))
  }, 500)

  const saveContextToStorage = useDebounceFn(
    (context: ExtendedMapContext, extent: Extent | null) => {
      const ctx = {
        ...context,
        ...getContext(),
        view: extent ? { ...context.view, extent } : context.view,
      }
      sessionStorage.setItem(SESSION_STORAGE_CONTEXT_KEY, JSON.stringify(ctx))
    },
    500,
  )

  // Persist initialContext changes to sessionStorage
  watchEffect(() => {
    if (ignoreNextInitialContextChange) {
      return
    }
    saveInitialContextToStorage(initialContext.value)
  })

  // Persist context changes to sessionStorage
  watchEffect(() => {
    if (ignoreNextContextChange) {
      return
    }
    saveContextToStorage(context.value, currentExtent.value)
  })
})
