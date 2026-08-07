import type { WpsEndpoint, WpsExecuteOptions, WpsExecuteResponse } from '@camptocamp/ogc-client'
import { useAddLayer } from '@/composables/useAddLayer'
import type { WpsOutputResult } from '@/types/wps.types'
import { classifyOutput, executeProcess, toLayers } from '@/utils/wps.utils'

export function useWps() {
  const { addLayer } = useAddLayer()

  async function addResultToMap(response: WpsExecuteResponse): Promise<WpsOutputResult[]> {
    const outputs = response.outputs.map(classifyOutput)
    let zoomed = false
    for (const output of outputs) {
      for (const layer of await toLayers(output)) {
        // setView is absolute, so zoom only on the first mapped layer (see plan).
        await addLayer(layer, !zoomed)
        zoomed = true
      }
    }
    return outputs
  }

  async function execute(
    endpoint: WpsEndpoint,
    processId: string,
    options: WpsExecuteOptions,
    onProgress?: (response: WpsExecuteResponse) => void,
  ): Promise<{ response: WpsExecuteResponse; outputs: WpsOutputResult[] }> {
    const response = await executeProcess(endpoint, processId, options, onProgress)
    const outputs = response.status === 'succeeded' ? await addResultToMap(response) : []
    return { response, outputs }
  }

  return { execute }
}
