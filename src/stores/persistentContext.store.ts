import { watch, watchEffect } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useMapStore, type ExtendedMapContext } from '@/stores/map.store'
import { defineStore, storeToRefs } from 'pinia'
import { isMapContext } from '@/utils/context.utils'

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

  /**
   * Reads a stored context, dropping the key when it cannot be used. Restores run in this store's
   * setup, so an unusable value must never throw: that would fail the whole viewer mount, and the
   * offending key would survive the reload.
   */
  function readStoredContext(key: string): ExtendedMapContext | undefined {
    const raw = sessionStorage.getItem(key)
    if (!raw) {
      return undefined
    }
    try {
      const parsed = JSON.parse(raw)
      if (isMapContext(parsed)) {
        return parsed
      }
      console.error(`Stored context is not a map context, dropping key ${key}`)
    } catch (error) {
      console.error(`Stored context is not readable, dropping key ${key}`, error)
    }
    sessionStorage.removeItem(key)
    return undefined
  }

  // apply any saved initial context present
  function restoreInitialContext() {
    const sessionInitialContext = readStoredContext(SESSION_STORAGE_INITIAL_CONTEXT_KEY)
    if (sessionInitialContext) {
      ignoreNextInitialContextChange = true
      setInitialContext(sessionInitialContext)
      ignoreNextInitialContextChange = false
    }
  }
  restoreInitialContext()

  // apply any saved context present
  function restoreContext() {
    const sessionContext = readStoredContext(SESSION_STORAGE_CONTEXT_KEY)
    if (sessionContext) {
      ignoreNextContextChange = true
      setContext(sessionContext)
      ignoreNextContextChange = false
    }
  }
  restoreContext()

  const saveInitialContextToStorage = useDebounceFn((initialContext: ExtendedMapContext) => {
    sessionStorage.setItem(SESSION_STORAGE_INITIAL_CONTEXT_KEY, JSON.stringify(initialContext))
  }, 500)

  const saveContextToStorage = useDebounceFn(() => {
    sessionStorage.setItem(SESSION_STORAGE_CONTEXT_KEY, JSON.stringify(getContext()))
  }, 500)

  // Persist initialContext changes to sessionStorage
  watchEffect(() => {
    if (ignoreNextInitialContextChange) {
      return
    }
    saveInitialContextToStorage(initialContext.value)
  })

  // Persist context changes to sessionStorage. Watching the sources explicitly (rather than a
  // watchEffect) because the debounced save re-reads them via getContext() instead of using them.
  watch(
    [context, currentExtent],
    () => {
      if (ignoreNextContextChange) {
        return
      }
      saveContextToStorage()
    },
    { immediate: true },
  )
})
