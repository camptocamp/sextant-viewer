import { WpsEndpoint, WmsEndpoint } from '@camptocamp/ogc-client'
import type {
  WpsProcessFull,
  WpsExecuteOptions,
  WpsExecuteResponse,
  WpsExecuteOutputResult,
  WpsInputValue,
} from '@camptocamp/ogc-client'
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useAddLayer } from '@/composables/useAddLayer'
import type { WpsFormInputs, WpsFormOutput, WpsOutputResult } from '@/types/wps.types'

const WMS_MIMETYPE_REGEX = /ogc-wms/i
// Faithful to Sextant: any json mime (application/json or geo+json) is treated as
// geometry. GML/XML remains unimplemented → download. Opaque mimes (octet-stream…)
// don't match here, so they stay downloads.
const GEOJSON_MIMETYPE_REGEX = /json/i
const POLL_INTERVAL_MS = 1000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ogc-client parses service URLs with `new URL()`, which rejects relative paths. Resolving
// against the page location lets a same-origin path be used (e.g. `/services/wps3/demo`,
// routed through the dev proxy in vite.config.ts, or served behind Sextant in production).
const resolveUrl = (url: string) => new URL(url, window.location.href).href

export function useWps() {
  const { addLayer } = useAddLayer()

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
  ): Promise<{ response: WpsExecuteResponse; outputs: WpsOutputResult[] }> {
    let response = await endpoint.execute(processId, options)
    onProgress?.(response)

    while (response.statusLocation && ['accepted', 'started', 'paused'].includes(response.status)) {
      await delay(POLL_INTERVAL_MS)
      response = await endpoint.getStatus(response.statusLocation)
      onProgress?.(response)
    }

    const outputs = response.status === 'succeeded' ? await addResultToMap(response) : []
    return { response, outputs }
  }

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

  async function toLayers(output: WpsOutputResult): Promise<MapContextLayer[]> {
    if (output.kind === 'wms') {
      // Faithful to Sextant: the href is a WMS GetCapabilities; load every named layer.
      const wms = await new WmsEndpoint(output.href).isReady()
      return wms
        .getFlattenedLayers()
        .filter((layer) => layer.name)
        .map((layer) => ({
          type: 'wms',
          url: output.href,
          name: layer.name!,
          label: layer.title || output.label,
        }))
    }
    if (output.kind === 'geojson') {
      if (output.url) return [{ type: 'geojson', url: output.url, label: output.label }]
      if (output.data) return [{ type: 'geojson', data: output.data, label: output.label }]
    }
    return []
  }

  return { loadProcesses, describe, buildExecuteOptions, execute, addResultToMap, classifyOutput }
}

/**
 * Classify an Execute output by semantic family, based on its mime type. The
 * decision is mime-driven: an opaque mime (octet-stream, CSV, binary…) is
 * always a download, never a layer — no content sniffing in v1.
 */
export function classifyOutput(output: WpsExecuteOutputResult): WpsOutputResult {
  const identifier = output.identifier
  const label = output.title || output.identifier
  const mimeType = output.reference?.mimeType ?? output.data?.mimeType ?? ''
  const href = output.reference?.href

  if (WMS_MIMETYPE_REGEX.test(mimeType) && href) {
    return { kind: 'wms', identifier, label, href }
  }

  if (GEOJSON_MIMETYPE_REGEX.test(mimeType)) {
    if (href) return { kind: 'geojson', identifier, label, url: href }
    if (output.data?.content)
      return { kind: 'geojson', identifier, label, data: output.data.content }
  }

  return { kind: 'download', identifier, label, href, data: output.data?.content, mimeType }
}
