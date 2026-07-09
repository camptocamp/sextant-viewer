import { WpsEndpoint, WmsEndpoint } from '@camptocamp/ogc-client'
import type {
  WpsProcessFull,
  WpsExecuteOptions,
  WpsExecuteResponse,
  WpsExecuteOutputResult,
  WpsInputValue,
} from '@camptocamp/ogc-client'
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useMapStore } from '@/stores/map.store'
import type { WpsFormInputs, WpsFormOutput } from '@/types/wps.types'

const WMS_MIMETYPE_REGEX = /ogc-wms|wms/i
const GEOJSON_MIMETYPE_REGEX = /json/i
const POLL_INTERVAL_MS = 1000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ogc-client parses service URLs with `new URL()`, which rejects relative paths. Resolving
// against the page location lets a same-origin path be used (e.g. `/services/wps3/demo`,
// routed through the dev proxy in vite.config.ts, or served behind Sextant in production).
const resolveUrl = (url: string) => new URL(url, window.location.href).href

export function useWps() {
  const mapStore = useMapStore()

  async function loadProcesses(url: string) {
    const endpoint = await new WpsEndpoint(resolveUrl(url)).isReady()
    return { endpoint, processes: endpoint.getProcesses() ?? [] }
  }

  function describe(endpoint: WpsEndpoint, processId: string) {
    return endpoint.describeProcess(processId)
  }

  function buildExecuteOptions(
    process: WpsProcessFull,
    formInputs: WpsFormInputs,
    formOutputs: WpsFormOutput[],
  ): WpsExecuteOptions {
    const inputs: WpsInputValue[] = []
    for (const input of process.inputs) {
      for (const occurrence of formInputs[input.identifier] ?? []) {
        if (input.type === 'literal' && occurrence.literalValue) {
          inputs.push({ identifier: input.identifier, literalValue: occurrence.literalValue })
        } else if (input.type === 'complex' && occurrence.complexContent) {
          inputs.push({
            identifier: input.identifier,
            complexValue: {
              mimeType: input.complexData?.default.mimeType ?? 'application/json',
              content: occurrence.complexContent,
            },
          })
        } else if (input.type === 'boundingbox' && occurrence.bboxValue) {
          const bbox = occurrence.bboxValue.split(',').map((n) => Number(n.trim()))
          if (bbox.length === 4 && !bbox.some(Number.isNaN)) {
            inputs.push({
              identifier: input.identifier,
              boundingBoxValue: {
                crs: input.boundingBoxData?.defaultCrs,
                bbox: bbox as [number, number, number, number],
              },
            })
          }
        }
      }
    }

    return {
      inputs,
      outputs: formOutputs.map((output) => ({
        identifier: output.identifier,
        mimeType: output.mimeType,
        asReference: output.asReference,
      })),
      storeExecuteResponse: process.storeSupported,
      status: process.statusSupported,
    }
  }

  async function execute(
    endpoint: WpsEndpoint,
    processId: string,
    options: WpsExecuteOptions,
    onProgress?: (response: WpsExecuteResponse) => void,
  ): Promise<{ response: WpsExecuteResponse; addedLayers: string[] }> {
    let response = await endpoint.execute(processId, options)
    onProgress?.(response)

    while (response.statusLocation && ['accepted', 'started', 'paused'].includes(response.status)) {
      await delay(POLL_INTERVAL_MS)
      response = await endpoint.getStatus(response.statusLocation)
      onProgress?.(response)
    }

    const addedLayers = response.status === 'succeeded' ? await addResultToMap(response) : []
    return { response, addedLayers }
  }

  async function addResultToMap(response: WpsExecuteResponse): Promise<string[]> {
    const added: string[] = []
    for (const output of response.outputs) {
      const layer = await outputToLayer(output)
      if (layer) {
        await mapStore.addLayer(layer)
        added.push(layer.label ?? output.identifier)
      }
    }
    return added
  }

  async function outputToLayer(output: WpsExecuteOutputResult): Promise<MapContextLayer | null> {
    const label = output.title || output.identifier
    const mimeType = output.reference?.mimeType ?? output.data?.mimeType ?? ''
    const href = output.reference?.href

    if (WMS_MIMETYPE_REGEX.test(mimeType) && href) {
      const wms = await new WmsEndpoint(href).isReady()
      const name = wms.getFlattenedLayers().find((layer) => layer.name)?.name
      if (!name) return null
      return { type: 'wms', url: href, name, label }
    }

    if (GEOJSON_MIMETYPE_REGEX.test(mimeType)) {
      if (href) return { type: 'geojson', url: href, label }
      if (output.data?.content) return { type: 'geojson', data: output.data.content, label }
    }

    return null
  }

  return { loadProcesses, describe, buildExecuteOptions, execute, addResultToMap }
}
