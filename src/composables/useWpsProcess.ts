import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import type {
  WpsEndpoint,
  WpsExecuteResponse,
  WpsProcessFull,
  WpsProcessSummary,
} from '@camptocamp/ogc-client'
import { useAddLayer } from '@/composables/useAddLayer'
import type { WpsFormInputs, WpsFormOutput, WpsOutputResult } from '@/types/wps.types'
import {
  buildExecuteOptions,
  classifyOutput,
  describeProcess,
  executeProcess,
  loadProcesses,
  toLayers,
} from '@/utils/wps.utils'

/**
 * The service → process → describe → execute sequence, shared by the global WPS panel (free-text
 * service URL) and the per-layer one (service and process named by the metadata record).
 *
 * Owns the polling controller: a run whose result the caller has moved on from is aborted rather
 * than left writing into `result`.
 */
export function useWpsProcess() {
  const { addLayer } = useAddLayer()

  const endpoint = shallowRef<WpsEndpoint | null>(null)
  const processes = ref<WpsProcessSummary[]>([])
  const selectedProcessId = ref<string>()
  const selectedProcess = ref<WpsProcessFull | null>(null)

  const formInputs = ref<WpsFormInputs>({})
  const formOutputs = ref<WpsFormOutput[]>([])

  const loading = ref(false)
  const describing = ref(false)
  const executing = ref(false)
  const error = ref<string | null>(null)
  const result = ref<WpsExecuteResponse | null>(null)
  const outputs = ref<WpsOutputResult[]>([])

  // Derived state rather than `result` itself: the progress callback reassigns `result` on every
  // poll, which a panel watching it to scroll would read as a new stage each time.
  const resultStage = computed(() => {
    if (error.value) return 'error'
    if (!result.value) return null
    return ['succeeded', 'failed'].includes(result.value.status) ? 'done' : 'pending'
  })

  // A poll that outlives what it was started for would keep writing into `result`, for a process
  // the caller has already moved on from.
  let poll: AbortController | null = null

  function stopPolling() {
    poll?.abort()
    poll = null
  }

  onScopeDispose(stopPolling)

  /** Everything a new process invalidates — the service and its process list aside. */
  function resetProcess() {
    stopPolling()
    selectedProcess.value = null
    result.value = null
    error.value = null
  }

  function resetService() {
    resetProcess()
    endpoint.value = null
    processes.value = []
    selectedProcessId.value = undefined
  }

  // Neither loadProcesses nor describeProcess takes a signal — ogc-client's WpsEndpoint offers
  // none — so a superseded request cannot be cancelled, only its writes discarded. Without that,
  // the slowest of two rapid choices wins by arriving last, and the form describes one process
  // against another one's endpoint.
  let currentRun = 0

  /** A response whose run is no longer the current one must not write: the caller moved on. */
  function isStale(run: number) {
    return run !== currentRun
  }

  /**
   * Load the service's processes, then the description of `processId` when a layer's metadata record
   * names it in advance. Each half claims a run of its own; the second is claimed only once the
   * first has committed, so a later choice always outranks anything still in flight.
   */
  async function loadService(url: string, processId?: string) {
    const run = ++currentRun
    resetService()
    loading.value = true
    try {
      const loaded = await loadProcesses(url)
      if (isStale(run)) return
      endpoint.value = loaded.endpoint
      processes.value = loaded.processes
    } catch (e) {
      if (isStale(run)) return
      const msg = `Failed to load processes from URL ${url}`
      console.error(msg, e)
      error.value = `${msg}: ${(e as Error).message}`
      return
    } finally {
      // Guarded like every other write: a stale run would otherwise clear the current run's flag.
      if (!isStale(run)) loading.value = false
    }

    if (processId) await loadProcess(processId)
  }

  async function loadProcess(processId: string | undefined) {
    const run = ++currentRun
    resetProcess()
    selectedProcessId.value = processId
    if (!endpoint.value || !processId) return
    describing.value = true
    try {
      const described = await describeProcess(endpoint.value, processId)
      if (isStale(run)) return
      selectedProcess.value = described
    } catch (e) {
      if (isStale(run)) return
      const msg = `Failed to describe process "${processId}"`
      console.error(msg, e)
      error.value = `${msg}: ${(e as Error).message}`
    } finally {
      if (!isStale(run)) describing.value = false
    }
  }

  async function runExecute() {
    if (!endpoint.value || !selectedProcess.value) return
    const process = selectedProcess.value
    executing.value = true
    error.value = null
    result.value = null
    outputs.value = []
    try {
      const options = buildExecuteOptions(process, formInputs.value, formOutputs.value)
      poll = new AbortController()
      const response = await executeProcess(endpoint.value, process.identifier, options, {
        // Progress only: the terminal response is assigned below, in the same tick as its outputs,
        // so the result block never renders half of itself.
        onProgress: (pending) => {
          if (!['succeeded', 'failed'].includes(pending.status)) result.value = pending
        },
        signal: poll.signal,
      })
      result.value = response
      outputs.value = response.status === 'succeeded' ? response.outputs.map(classifyOutput) : []
    } catch (e) {
      // An abort is the caller's own doing: it has already moved on, and reported nothing to fix.
      if ((e as Error).name === 'AbortError') return
      const msg = `Failed to execute process "${process.identifier}"`
      console.error(msg, e)
      error.value = `${msg}: ${(e as Error).message}`
      return
    } finally {
      executing.value = false
    }

    await addOutputsToMap()
  }

  function replaceOutput(previous: WpsOutputResult, updated: WpsOutputResult) {
    outputs.value = outputs.value.map((output) => (output === previous ? updated : output))
  }

  /**
   * Put every output standing for a layer on the map, replacing it once its status is settled.
   * A failure is carried by the output itself rather than thrown: the process did succeed, so
   * its results are worth keeping on screen.
   */
  async function addOutputsToMap() {
    let zoomed = false
    for (const output of outputs.value) {
      if (output.mapStatus !== 'pending') continue
      try {
        const layers = await toLayers(output)
        if (!layers.length) throw new Error('aucune couche nommée')
        for (const layer of layers) {
          // setView is absolute, so zoom only on the first mapped layer.
          await addLayer(layer, !zoomed)
          zoomed = true
        }
        replaceOutput(output, { ...output, mapStatus: 'added' })
      } catch (e) {
        console.error(`Failed to add WPS output "${output.identifier}" to the map`, e)
        replaceOutput(output, { ...output, mapStatus: 'failed', mapError: (e as Error).message })
      }
    }
  }

  return {
    endpoint,
    processes,
    selectedProcessId,
    selectedProcess,
    formInputs,
    formOutputs,
    loading,
    describing,
    executing,
    error,
    result,
    outputs,
    resultStage,
    loadService,
    loadProcess,
    runExecute,
  }
}
