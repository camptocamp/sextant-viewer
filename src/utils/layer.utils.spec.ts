import { describe, expect, it } from 'vitest'
import { applyWmsFilter, stripAttributeFilterExtras } from './layer.utils'
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
  it('encodes active selections as the layer filter and strips app-only extras', () => {
    const result = applyWmsFilter(
      wmsLayer({
        filter: [{ attributeName: 'THEME', matchType: 'equals', values: ['a'] }],
        dataIndex: { url: 'https://host/es', featureTypeIds: ['ft'] },
      }),
    ) as ExtendedMapLayerWms

    expect(result.filter).toContain('THEME')
    expect(result.extras?.filter).toBeUndefined()
    expect(result.extras?.dataIndex).toBeUndefined()
  })

  it('emits no filter when the selection is empty', () => {
    const result = applyWmsFilter(wmsLayer({ filter: [] })) as ExtendedMapLayerWms

    expect(result.filter).toBeUndefined()
  })

  it('preserves customParams untouched alongside the filter', () => {
    const result = applyWmsFilter(
      wmsLayer(
        { filter: [{ attributeName: 'T', matchType: 'equals', values: ['x'] }] },
        { OTHER: 'keep' },
      ),
    ) as ExtendedMapLayerWms

    expect(result.customParams?.OTHER).toBe('keep')
    expect(result.filter).toContain('T')
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

describe('stripAttributeFilterExtras', () => {
  it('drops the internal dataIndex and filter extras, keeping the rest', () => {
    const result = stripAttributeFilterExtras(
      wmsLayer({
        filter: [{ attributeName: 'THEME', matchType: 'equals', values: ['a'] }],
        dataIndex: { url: 'https://host/es', featureTypeIds: ['ft'] },
        wmsDimensions: [],
      } as ExtendedMapLayerWms['extras']),
    ) as ExtendedMapLayerWms

    expect(result.extras?.dataIndex).toBeUndefined()
    expect(result.extras?.filter).toBeUndefined()
    expect(result.extras).toHaveProperty('wmsDimensions')
  })

  it('returns the layer unchanged when it carries no attribute-filter extras', () => {
    const layer = wmsLayer({ wmsDimensions: [] } as ExtendedMapLayerWms['extras'])
    expect(stripAttributeFilterExtras(layer)).toBe(layer)
  })

  it('leaves non-wms layers untouched', () => {
    const layer = { type: 'wmts', name: 'x' } as MapContextLayer
    expect(stripAttributeFilterExtras(layer)).toBe(layer)
  })
})
