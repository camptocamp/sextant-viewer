import type { WpsProcessFull, WpsProcessInput } from '@camptocamp/ogc-client'
import type {
  WpsApplicationProfile,
  WpsFormInputs,
  WpsInputOccurrence,
  WpsProfileInput,
} from '@/types/wps.types'

const FROM_SUFFIX = '.from'
const TO_SUFFIX = '.to'
const DEFAULT_DELIMITER = ','

/**
 * Values a linked filter supplies to an input, in occurrence order — ported 1:1 from the legacy
 * client:
 *   - a `.from` / `.to` suffix reads one end of a range filter (which stores `[from, to]`);
 *   - `tokenizeWfsFilterValues` **joins** every selected value into a single one — it is not a
 *     split — using `wfsFilterValuesDelimiter`, `,` by default;
 *   - otherwise each selected value becomes its own occurrence.
 *
 * `[]` when the input is not linked, or the column carries no selection: the process then applies
 * its own default, which is what the legacy did when the user had filtered nothing.
 */
export function linkedFilterValues(
  profileInput: WpsProfileInput,
  filters: Record<string, string[]>,
): string[] {
  const linked = profileInput.linkedWfsFilter
  if (!linked) return []

  let rangeIndex = -1
  let suffixLength = 0
  if (linked.endsWith(FROM_SUFFIX)) {
    rangeIndex = 0
    suffixLength = FROM_SUFFIX.length
  } else if (linked.endsWith(TO_SUFFIX)) {
    rangeIndex = 1
    suffixLength = TO_SUFFIX.length
  }
  const column = suffixLength ? linked.slice(0, -suffixLength) : linked

  const values = filters[column] ?? []
  if (!values.length) return []

  if (rangeIndex >= 0) {
    const bound = values[rangeIndex]
    return bound ? [bound] : []
  }
  if (profileInput.tokenizeWfsFilterValues) {
    return [values.join(profileInput.wfsFilterValuesDelimiter ?? DEFAULT_DELIMITER)]
  }
  return values
}

/** Carry a profile value on the field of the occurrence that matches the input's type. */
function occurrenceFor(input: WpsProcessInput, value: string): WpsInputOccurrence {
  if (input.type === 'complex') return { complexContent: value }
  if (input.type === 'boundingbox') return { bboxValue: value }
  return { literalValue: value }
}

/**
 * Overlay the profile on a freshly built form: which occurrences it holds, and which inputs the
 * form must not render or must render read-only.
 *
 * Value priority, as in the legacy client: linked filter values (capped at `maxOccurs`, one
 * occurrence each) > `profile.defaultValue` > whatever `base` already holds (the process's own
 * `literalData.defaultValue` and the boolean handling around it). `base` is the result of the
 * form's own initialisation and is only overridden here, never rebuilt.
 *
 * An input the profile says nothing about is left exactly as `base` had it: the profile annotates
 * the process description, it is not a whitelist.
 */
export function applyProfile(
  process: WpsProcessFull,
  base: WpsFormInputs,
  profile: WpsApplicationProfile | undefined,
  filters: Record<string, string[]>,
): { inputs: WpsFormInputs; overridden: Set<string>; hidden: Set<string> } {
  const inputs: WpsFormInputs = { ...base }
  const overridden = new Set<string>()
  const hidden = new Set<string>()

  for (const input of process.inputs) {
    const profileInput = profile?.inputs?.find((entry) => entry.identifier === input.identifier)
    if (!profileInput) continue

    // A hidden input is not rendered, but its value is still sent — that is what makes the whole
    // wiring invisible to the user.
    if (profileInput.hidden) hidden.add(input.identifier)

    const linked = linkedFilterValues(profileInput, filters).slice(0, input.maxOccurs)
    if (linked.length) {
      overridden.add(input.identifier)
      inputs[input.identifier] = linked.map((value) => occurrenceFor(input, value))
      continue
    }

    if (profileInput.defaultValue) {
      const occurrences = [...(inputs[input.identifier] ?? [])]
      occurrences[0] = occurrenceFor(input, profileInput.defaultValue)
      inputs[input.identifier] = occurrences
    }
  }

  return { inputs, overridden, hidden }
}

/**
 * The `defaultMimeType` the profile names for an output, if it names one — the output-side
 * counterpart of an input's `defaultValue`. A WMS format the service advertises still wins over it,
 * which is the legacy order and stays the form's decision.
 */
export function profileOutputMimeType(
  profile: WpsApplicationProfile | undefined,
  identifier: string,
): string | undefined {
  return profile?.outputs?.find((output) => output.identifier === identifier)?.defaultMimeType
}
