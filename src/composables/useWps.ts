import { useAddLayer } from '@/composables/useAddLayer'
import type { WpsOutputResult } from '@/types/wps.types'
import { toLayers } from '@/utils/wps.utils'

export function useWps() {
  const { addLayer } = useAddLayer()

  /**
   * Put every output standing for a layer on the map, handing back a replacement for each one
   * once its status is settled. A failure is carried by the output itself rather than thrown:
   * the process did succeed, so its results are worth keeping on screen.
   */
  async function addOutputsToMap(
    outputs: WpsOutputResult[],
    onUpdate: (previous: WpsOutputResult, updated: WpsOutputResult) => void,
  ): Promise<void> {
    let zoomed = false
    for (const output of outputs) {
      if (output.mapStatus !== 'pending') continue
      try {
        const layers = await toLayers(output)
        if (!layers.length) throw new Error('aucune couche nommée')
        for (const layer of layers) {
          // setView is absolute, so zoom only on the first mapped layer (see plan).
          await addLayer(layer, !zoomed)
          zoomed = true
        }
        onUpdate(output, { ...output, mapStatus: 'added' })
      } catch (e) {
        console.error(`Failed to add WPS output "${output.identifier}" to the map`, e)
        onUpdate(output, { ...output, mapStatus: 'failed', mapError: (e as Error).message })
      }
    }
  }

  return { addOutputsToMap }
}
