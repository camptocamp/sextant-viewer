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
 * Classification of a single Execute output by semantic family. It is the
 * shared source of truth between the map-add path (useWps) and the rendering
 * (WpsExecuteResult), replacing the previous list-of-labels approach.
 *
 * `mapStatus` and `mapError` are written by the add-to-map chain alone, and stay absent on an
 * output that stands for no layer — deciding that is the chain's job, not the rendering's.
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
