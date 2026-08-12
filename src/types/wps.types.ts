export type {
  WpsProcessInput,
  WpsProcessOutput,
  WpsInputValue,
  WpsOutputSelection,
} from '@camptocamp/ogc-client'

/**
 * A single occurrence of an input value being edited in the form. Only the
 * field matching the input type is used; the others stay empty.
 */
export interface WpsInputOccurrence {
  literalValue?: string
  complexContent?: string
  bboxValue?: string // "minX,minY,maxX,maxY"
}

/** A WPS service declared on the map context, offered as a choice in the WPS panel. */
export interface WpsService {
  url: string
  label?: string
}

/**
 * `applicationProfile` of an `OGC:WPS` online resource: declarative customisation of the form.
 *
 * Deliberately partial: the legacy profile also carries `outputs[].displayGraphOptions` (the
 * "profile graph" mode, out of scope). Undeclared keys survive `JSON.parse` and are just ignored.
 */
export interface WpsApplicationProfile {
  inputs?: WpsProfileInput[]
  outputs?: WpsProfileOutput[]
}

export interface WpsProfileInput {
  identifier: string
  defaultValue?: string
  hidden?: boolean
  disabled?: boolean
  /** Attribute-filter column feeding this input; `.from` / `.to` suffixes read one end of a range. */
  linkedWfsFilter?: string
  /** Join the selected values into a single one (instead of one occurrence per value). */
  tokenizeWfsFilterValues?: boolean
  /** Delimiter of the join above; `,` by default. */
  wfsFilterValuesDelimiter?: string
}

export interface WpsProfileOutput {
  identifier: string
  /** Mime type offered by default. A WMS format of that output still wins (legacy order). */
  defaultMimeType?: string
}

/**
 * A WPS process a layer's metadata record declares: the service, the process, and the profile
 * wiring its inputs onto the layer's attribute filter.
 */
export interface LayerWpsProcess {
  /** WPS service URL, from the resource's `linkage`. */
  url: string
  /** Process identifier, from the resource's `<cit:name>`. */
  processId: string
  /** Human-readable label, from the resource's `<cit:description>`. */
  label?: string
  profile?: WpsApplicationProfile
}

/** Form state for a whole process: input identifier → its occurrences (≥ 1). */
export type WpsFormInputs = Record<string, WpsInputOccurrence[]>

/**
 * Form state for a single output: whether it is asked for, and in which format.
 * Every output of the process gets an entry, selected or not, so the form can list them all —
 * an output silently requested is as misleading as one silently dropped.
 */
export interface WpsFormOutput {
  identifier: string
  selected: boolean
  mimeType?: string
  asReference: boolean
}

export type WpsOutputMapStatus = 'pending' | 'added' | 'failed'

/**
 * Classification of a single Execute output by semantic family.
 *
 * `mapStatus` and `mapError` stay absent on an output that stands for no layer.
 */
export type WpsOutputResult = (
  | { kind: 'wms'; identifier: string; label: string; href: string }
  | {
      kind: 'geojson'
      identifier: string
      label: string
      url?: string
      data?: string
      mimeType?: string
    }
  | {
      kind: 'download'
      identifier: string
      label: string
      href?: string
      data?: string
      mimeType?: string
    }
) & { mapStatus?: WpsOutputMapStatus; mapError?: string }
