import type {
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

/** Form state for a whole process: input identifier → its occurrences (≥ 1). */
export type WpsFormInputs = Record<string, WpsInputOccurrence[]>

/** Selected output format for a single output. */
export interface WpsFormOutput {
  identifier: string
  mimeType?: string
  asReference: boolean
}

export type { WpsProcessInput, WpsProcessOutput, WpsInputValue, WpsOutputSelection }
