import type { ExtendedMapContext } from '@/types/map.types'

/**
 * Shape guard for a context coming from an untyped source (web component API, sessionStorage,
 * imported file). It only checks what would break enrichment — `enrichContext` maps over `layers`
 * and `backgroundLayers` — since validating layer contents is the SDK's business, and a stricter
 * schema would reject contexts produced by a newer SDK version.
 */
export function isMapContext(value: unknown): value is ExtendedMapContext {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { layers, backgroundLayers } = value as Record<string, unknown>
  return (
    (layers === undefined || Array.isArray(layers)) &&
    (backgroundLayers === undefined || Array.isArray(backgroundLayers))
  )
}

/** Guard variant for boundaries that must report the failure to their caller. */
export function assertMapContext(value: unknown): asserts value is ExtendedMapContext {
  if (!isMapContext(value)) {
    throw new TypeError(
      'Invalid map context: expected an object whose `layers` and `backgroundLayers`, ' +
        'when present, are arrays',
    )
  }
}
