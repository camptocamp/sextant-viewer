import { describe, expect, it } from 'vitest'
import { applyWmsFilter } from './layer.utils'
import type { ExtendedMapLayerWms } from '@/types/wms.types'
import type { MapContextLayer } from '@geospatial-sdk/core'

const wmsLayer = (extras?: ExtendedMapLayerWms['extras'], customParams?: Record<string, string>) =>
  ({
    type: 'wms',
    name: 'ns:layer',
    url: 'https://host/wms',
    extras,
    customParams,
  }) as MapContextLayer

describe('applyWmsFilter', () => {
  it('encodes active selections as the customParams FILTER and strips app-only extras', () => {
    const result = applyWmsFilter(
      wmsLayer({
        filter: [{ attributeName: 'THEME', matchType: 'equals', values: ['a'] }],
        dataIndex: { url: 'https://host/es', featureTypeIds: ['ft'] },
      }),
    ) as ExtendedMapLayerWms

    expect(result.customParams?.FILTER).toContain('THEME')
    expect(result.extras?.filter).toBeUndefined()
    expect(result.extras?.dataIndex).toBeUndefined()
  })

  it('removes a stale FILTER key when the selection is empty', () => {
    const result = applyWmsFilter(
      wmsLayer({ filter: [] }, { FILTER: 'stale', OTHER: 'keep' }),
    ) as ExtendedMapLayerWms

    expect(result.customParams).not.toHaveProperty('FILTER')
    expect(result.customParams?.OTHER).toBe('keep')
  })

  it('preserves pre-existing customParams alongside the filter', () => {
    const result = applyWmsFilter(
      wmsLayer(
        { filter: [{ attributeName: 'T', matchType: 'equals', values: ['x'] }] },
        { OTHER: 'keep' },
      ),
    ) as ExtendedMapLayerWms

    expect(result.customParams?.OTHER).toBe('keep')
    expect(result.customParams?.FILTER).toContain('T')
  })

  it('leaves non-wms layers untouched', () => {
    const layer = { type: 'wmts', name: 'x' } as MapContextLayer
    expect(applyWmsFilter(layer)).toBe(layer)
  })

  it('never touches a consumer-supplied FILTER on a layer outside the attribute-filter feature', () => {
    const layer = wmsLayer(undefined, { FILTER: 'consumer-crafted' })
    expect(applyWmsFilter(layer)).toBe(layer)
  })
})
