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

/** Form state for a whole process: input identifier → its occurrences (≥ 1). */
export type WpsFormInputs = Record<string, WpsInputOccurrence[]>

/** Selected output format for a single output. */
export interface WpsFormOutput {
  identifier: string
  mimeType?: string
  asReference: boolean
}

/**
 * Classification of a single Execute output by semantic family. It is the
 * shared source of truth between the map-add path (useWps) and the rendering
 * (WpsExecuteResult), replacing the previous list-of-labels approach.
 */
export type WpsOutputResult =
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
