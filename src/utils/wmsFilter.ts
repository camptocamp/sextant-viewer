import type { ActiveFilters, AttributeFieldConfig } from '@/types/attribute-filter.types'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Escape OGC LIKE wildcards so user values match literally (paired with escapeChar="!").
function escapeLikeWildcards(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`)
}

function buildComparison(field: AttributeFieldConfig, value: string): string {
  const property = xmlEscape(field.esField)
  if ((field.match ?? 'equals') === 'contains') {
    const literal = xmlEscape(`%${escapeLikeWildcards(value)}%`)
    return (
      '<PropertyIsLike wildCard="%" singleChar="_" escapeChar="!">' +
      `<PropertyName>${property}</PropertyName><Literal>${literal}</Literal></PropertyIsLike>`
    )
  }
  return (
    `<PropertyIsEqualTo><PropertyName>${property}</PropertyName>` +
    `<Literal>${xmlEscape(value)}</Literal></PropertyIsEqualTo>`
  )
}

function buildFieldGroup(field: AttributeFieldConfig, values: string[]): string {
  const comparisons = values.map((value) => buildComparison(field, value)).join('')
  return values.length > 1 ? `<Or>${comparisons}</Or>` : comparisons
}

/**
 * Build the inner body of an OGC Filter from the active selections: each column's
 * selected values are OR-ed together, and the columns are AND-ed. Returns `null`
 * when no column has a selected value.
 */
export function buildFilterBody(
  active: ActiveFilters,
  fields: AttributeFieldConfig[],
): string | null {
  const groups: string[] = []
  for (const field of fields) {
    const values = (active[field.esField] ?? []).filter((value) => value != null && value !== '')
    if (values.length > 0) {
      groups.push(buildFieldGroup(field, values))
    }
  }
  if (groups.length === 0) return null
  const joined = groups.join('')
  return groups.length === 1 ? joined : `<And>${joined}</And>`
}

/**
 * Build the WMS `FILTER` GetMap parameter value for a (possibly multi-sublayer)
 * layer. QGIS Server expects one parenthesised `<Filter>` group per sublayer when
 * `LAYERS` holds several comma-separated names. Returns `null` when there is no
 * active filter.
 */
export function buildWmsFilterParam(
  layerName: string,
  active: ActiveFilters,
  fields: AttributeFieldConfig[],
): string | null {
  const body = buildFilterBody(active, fields)
  if (!body) return null
  const filter = `<Filter>${body}</Filter>`
  const sublayers = layerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return sublayers.length > 1 ? sublayers.map(() => `(${filter})`).join('') : filter
}
