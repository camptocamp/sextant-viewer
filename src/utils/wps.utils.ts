import { WpsEndpoint, WmsEndpoint } from '@camptocamp/ogc-client'
import type {
  WpsProcessFull,
  WpsProcessInput,
  WpsExecuteOptions,
  WpsExecuteResponse,
  WpsExecuteOutputResult,
  WpsInputValue,
} from '@camptocamp/ogc-client'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type {
  WpsFormInputs,
  WpsFormOutput,
  WpsInputOccurrence,
  WpsOutputResult,
} from '@/types/wps.types'

const WMS_MIMETYPE_REGEX = /ogc-wms/i
// Faithful to Sextant: any json mime (application/json or geo+json) is treated as
// geometry. GML/XML remains unimplemented → download. Opaque mimes (octet-stream…)
// don't match here, so they stay downloads.
const GEOJSON_MIMETYPE_REGEX = /json/i
const POLL_INTERVAL_MS = 1000
// Anything else ('succeeded', 'failed', 'dismissed') is terminal and stops the polling.
const PENDING_STATUSES = new Set(['accepted', 'started', 'paused'])

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ogc-client parses service URLs with `new URL()`, which rejects relative paths. Resolving
// against the page location lets a same-origin path be used (e.g. `/services/wps3/demo`,
// routed through the dev proxy in vite.config.ts, or served behind Sextant in production).
const resolveUrl = (url: string) => new URL(url, globalThis.location.href).href

/**
 * Read a service's process list from its capabilities.
 * The endpoint is returned alongside because it is the handle every later call needs
 * (describe, execute): it caches the parsed capabilities, so the caller keeps it rather
 * than rebuilding one per request.
 */
export async function loadProcesses(url: string) {
  const endpoint = await new WpsEndpoint(resolveUrl(url)).isReady()
  return { endpoint, processes: endpoint.getProcesses() ?? [] }
}

/**
 * Fetch the full description of a process — its inputs, their types and their cardinality.
 * Capabilities only carry summaries, so this DescribeProcess round-trip is what the form
 * needs before it can render any field.
 */
export function describeProcess(endpoint: WpsEndpoint, processId: string) {
  return endpoint.describeProcess(processId)
}

/**
 * Describe an input's cardinality, or null when it accepts exactly one value — the "required"
 * marker already says everything there is to say, and a hint would be noise.
 * `maxOccurs` is Infinity for a `maxOccurs="unbounded"` input, which is how ogc-client parses it.
 */
export function cardinalityLabel(input: WpsProcessInput): string | null {
  const { minOccurs, maxOccurs } = input
  if (maxOccurs === 1) return null
  if (minOccurs === 0) {
    return Number.isFinite(maxOccurs)
      ? `jusqu'à ${maxOccurs} valeurs`
      : 'plusieurs valeurs possibles'
  }
  if (!Number.isFinite(maxOccurs)) {
    return `${minOccurs} valeur${minOccurs > 1 ? 's' : ''} minimum`
  }
  return `de ${minOccurs} à ${maxOccurs} valeurs`
}

// ogc-client reads the text of <ows:DataType>, not its ows:reference attribute: the value is the
// short name ('boolean', 'xs:boolean'), never the schema URL.
const BOOLEAN_DATATYPE_REGEX = /boolean/i

/** Whether an input takes a boolean literal, and so deserves a checkbox rather than a text field. */
export function isBooleanInput(input: WpsProcessInput): boolean {
  return input.type === 'literal' && BOOLEAN_DATATYPE_REGEX.test(input.literalData?.dataType ?? '')
}

/**
 * Read a WPS boolean literal, or undefined when there is none — which is the form's "unset"
 * state, not a false value.
 * XML Schema accepts 'true'/'false' as well as '1'/'0', and servers are inconsistent about case:
 * normalising here keeps the form from displaying "Non" for a 'True' defaultValue.
 */
export function parseBooleanLiteral(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return undefined
}

export type WpsTemporalInputType = 'date' | 'datetime-local' | 'time'

/**
 * The three temporal literals, keyed by the local name of their `<ows:DataType>`.
 * `lexical` is both what the native widget can display and what XML Schema accepts;
 * `missingSeconds` matches the shorter form the widget produces at its default step, which
 * xs:time and xs:dateTime reject — seconds are mandatory in their lexical space.
 */
const TEMPORAL_LITERALS = {
  date: {
    inputType: 'date',
    lexical: /^\d{4}-\d{2}-\d{2}$/,
    missingSeconds: null,
  },
  datetime: {
    inputType: 'datetime-local',
    lexical: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/,
    missingSeconds: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  },
  time: {
    inputType: 'time',
    lexical: /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/,
    missingSeconds: /^\d{2}:\d{2}$/,
  },
} as const satisfies Record<
  string,
  { inputType: WpsTemporalInputType; lexical: RegExp; missingSeconds: RegExp | null }
>

// Matching on the local name rather than the whole string is what keeps 'dateTime' from being
// read as a time: a substring test would match both. It also covers the prefixed ('xs:date') and
// URL ('…xmlschema-2/#dateTime') spellings servers use for the same type.
const localName = (dataType: string) =>
  dataType
    .trim()
    .toLowerCase()
    .match(/[^:/#]+$/)?.[0] ?? ''

function temporalLiteral(input: WpsProcessInput) {
  if (input.type !== 'literal') return null
  const key = localName(input.literalData?.dataType ?? '')
  return key in TEMPORAL_LITERALS ? TEMPORAL_LITERALS[key as keyof typeof TEMPORAL_LITERALS] : null
}

/**
 * The native input type a temporal literal deserves, or null for anything else — a plain
 * text field is a poor way to ask for an ISO date the user has to spell out from memory.
 */
export function temporalInputType(input: WpsProcessInput): WpsTemporalInputType | null {
  return temporalLiteral(input)?.inputType ?? null
}

/**
 * Whether the native widget of that type can display this value. An empty string can: an
 * unfilled field is not a malformed one.
 */
export function isNativeTemporalValue(type: WpsTemporalInputType, value: string): boolean {
  const literal = Object.values(TEMPORAL_LITERALS).find((entry) => entry.inputType === type)
  return !value || !!literal?.lexical.test(value)
}

/**
 * Complete the seconds the native widget leaves out, so the value matches the lexical space of
 * its type. Anything else — a date, an already complete value, a non-temporal input — is
 * returned untouched, which lets `toInputValue` call this unconditionally.
 */
export function normalizeTemporalLiteral(input: WpsProcessInput, value: string): string {
  const literal = temporalLiteral(input)
  return literal?.missingSeconds?.test(value) ? `${value}:00` : value
}

type Bbox = [number, number, number, number]

/**
 * Parse the "minX,minY,maxX,maxY" string typed in the form, or null if it is not four
 * usable numbers.
 * Deliberately CRS-agnostic: the process picks the CRS (`boundingBoxData.defaultCrs`), so
 * coordinate ranges cannot be checked here — 500000 is out of bounds in EPSG:4326 and
 * ordinary in EPSG:3857. Geographic validation belongs to whoever knows the CRS.
 */
export function parseBbox(value: string): Bbox | null {
  // A blank coordinate must be rejected, not read as Number('') === 0.
  const parts = value.split(',').map((n) => n.trim())
  const bbox = parts.map(Number)
  return parts.length === 4 && parts.every(Boolean) && !bbox.some(Number.isNaN)
    ? (bbox as Bbox)
    : null
}

/**
 * Whether the user typed anything into an occurrence, whatever its usability.
 * Distinct from `toInputValue() !== null`, and deliberately so: "was this field touched" and
 * "does this field yield a value" are different questions, and a touched field the request
 * builder would drop is a typo to report rather than an omission to ignore.
 */
export function occurrenceHasContent(occurrence: WpsInputOccurrence): boolean {
  return !!(occurrence.literalValue || occurrence.complexContent || occurrence.bboxValue)
}

/**
 * Turn one form occurrence into the value to send for that input.
 * The occurrence holds one field per input type and only the matching one is read, so a
 * literal value typed into a complex input is ignored rather than mis-sent. Returns null
 * when the occurrence is empty or unusable, which is how the caller drops it: an untouched
 * field must not reach the server as an empty value.
 */
export function toInputValue(
  input: WpsProcessInput,
  occurrence: WpsInputOccurrence,
): WpsInputValue | null {
  if (input.type === 'literal' && occurrence.literalValue) {
    return {
      identifier: input.identifier,
      literalValue: normalizeTemporalLiteral(input, occurrence.literalValue),
    }
  }
  if (input.type === 'complex' && occurrence.complexContent) {
    return {
      identifier: input.identifier,
      complexValue: {
        mimeType: input.complexData?.default.mimeType ?? 'application/json',
        content: occurrence.complexContent,
      },
    }
  }
  if (input.type === 'boundingbox' && occurrence.bboxValue) {
    const bbox = parseBbox(occurrence.bboxValue)
    if (!bbox) return null
    return {
      identifier: input.identifier,
      boundingBoxValue: { crs: input.boundingBoxData?.defaultCrs, bbox },
    }
  }
  return null
}

/**
 * Assemble the Execute request from the process description and the form state.
 * Iterating over `process.inputs` rather than the form keys makes the process the authority
 * on input order, and silently drops form entries the process does not declare. Only the
 * outputs the user kept selected are requested. The async flags mirror what the process
 * advertises: asking for a stored, status-polled response on a server that supports neither
 * is a rejected request.
 */
export function buildExecuteOptions(
  process: WpsProcessFull,
  formInputs: WpsFormInputs,
  formOutputs: WpsFormOutput[],
): WpsExecuteOptions {
  const inputs = process.inputs.flatMap((input) =>
    (formInputs[input.identifier] ?? [])
      .map((occurrence) => toInputValue(input, occurrence))
      .filter((value): value is WpsInputValue => value !== null),
  )

  return {
    inputs,
    outputs: formOutputs
      .filter((output) => output.selected)
      .map((output) => ({
        identifier: output.identifier,
        mimeType: output.mimeType,
        asReference: output.asReference,
      })),
    storeExecuteResponse: process.storeSupported,
    status: process.statusSupported,
  }
}

/**
 * Classify an Execute output by semantic family, based on its mime type. The
 * decision is mime-driven: an opaque mime (octet-stream, CSV, binary…) is
 * always a download, never a layer — no content sniffing in v1. The families that do stand for
 * a layer start out pending on the map.
 */
export function classifyOutput(output: WpsExecuteOutputResult): WpsOutputResult {
  const identifier = output.identifier
  const label = output.title || output.identifier
  const mimeType = output.reference?.mimeType ?? output.data?.mimeType ?? ''
  const href = output.reference?.href
  const mapStatus = 'pending' as const

  if (WMS_MIMETYPE_REGEX.test(mimeType) && href) {
    return { kind: 'wms', identifier, label, href, mapStatus }
  }

  if (GEOJSON_MIMETYPE_REGEX.test(mimeType)) {
    if (href) return { kind: 'geojson', identifier, label, url: href, mimeType, mapStatus }
    if (output.data?.content)
      return {
        kind: 'geojson',
        identifier,
        label,
        data: output.data.content,
        mimeType,
        mapStatus,
      }
  }

  return { kind: 'download', identifier, label, href, data: output.data?.content, mimeType }
}

/**
 * Build the map layers an output stands for — none for a 'download' output, which is offered
 * as a file instead. A single WMS output expands to several layers, hence the array.
 */
export async function toLayers(output: WpsOutputResult): Promise<MapContextLayer[]> {
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

/**
 * Run an Execute request to completion, polling the status location while the process is
 * still pending. A synchronous process answers on the first call and the loop never runs;
 * `onProgress` fires on every response so the panel can show the status as it evolves.
 * Adding the outputs to the map is the caller's job (see useWps), which keeps this free of
 * any map side effect — and testable without one.
 */
export async function executeProcess(
  endpoint: WpsEndpoint,
  processId: string,
  options: WpsExecuteOptions,
  onProgress?: (response: WpsExecuteResponse) => void,
): Promise<WpsExecuteResponse> {
  let response = await endpoint.execute(processId, options)
  onProgress?.(response)

  while (response.statusLocation && PENDING_STATUSES.has(response.status)) {
    await delay(POLL_INTERVAL_MS)
    response = await endpoint.getStatus(response.statusLocation)
    onProgress?.(response)
  }

  return response
}
