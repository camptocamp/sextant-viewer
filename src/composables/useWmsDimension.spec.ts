import { describe, expect, it, vi } from 'vitest'
import type { MapLayer } from '@/utils/layer.utils'
import type { AnyWmsDimension } from '@/utils/wms.utils'
import type { WmsLayerDimension, WmsLayerTimeDimension } from '@camptocamp/ogc-client'

const updateLayer = vi.fn()
vi.mock('@/stores/map.store', () => ({ useMapStore: () => ({ updateLayer }) }))

import { useWmsDimension } from './useWmsDimension'

const scalarDim = (over: Partial<WmsLayerDimension> = {}): WmsLayerDimension => ({
  name: 'elevation',
  units: 'meters',
  values: [],
  nearestValue: false,
  multipleValues: false,
  ...over,
})

function makeLayer(dims: AnyWmsDimension[], layer: Record<string, unknown> = {}): MapLayer {
  return {
    type: 'wms',
    name: 'lyr',
    extras: { wmsDimensions: dims },
    ...layer,
  } as unknown as MapLayer
}

describe('useWmsDimension', () => {
  it('routes elevation to elevationValue', () => {
    updateLayer.mockClear()
    const layer = makeLayer([scalarDim({ values: [0, 10] })], { elevationValue: '10' })
    const { value } = useWmsDimension(layer, 'elevation')

    expect(value.value).toBe('10')
    value.value = '0'
    expect(updateLayer).toHaveBeenCalledWith(layer, { elevationValue: '0' })
  })

  it('routes elevation to elevationValue even when the server upper-cased it', () => {
    updateLayer.mockClear()
    // ogc-client classifies case-sensitively, so ELEVATION lands in otherDimensions.
    const layer = makeLayer([scalarDim({ name: 'ELEVATION', values: [0, 10] })])
    const { value } = useWmsDimension(layer, 'ELEVATION')

    value.value = '10'
    expect(updateLayer).toHaveBeenCalledWith(layer, { elevationValue: '10' })
  })

  it('routes any other dimension to otherDimensionValues under the server key', () => {
    updateLayer.mockClear()
    const layer = makeLayer([scalarDim({ name: 'band', units: '' })], {
      otherDimensionValues: { other: 'kept' },
    })
    const { value } = useWmsDimension(layer, 'band')

    value.value = 'red'
    // Not upper-cased here: the SDK builds DIM_<NAME> itself.
    expect(updateLayer).toHaveBeenCalledWith(layer, {
      otherDimensionValues: { other: 'kept', band: 'red' },
    })
  })

  it('clears the last other dimension to undefined, not to an empty object', () => {
    updateLayer.mockClear()
    const layer = makeLayer([scalarDim({ name: 'band', units: '' })], {
      otherDimensionValues: { band: 'red' },
    })
    const { value } = useWmsDimension(layer, 'band')

    value.value = undefined
    // `getHash` keeps `{}` but drops an undefined value, so an empty object would diff the layer.
    expect(updateLayer).toHaveBeenCalledWith(layer, { otherDimensionValues: undefined })
  })

  it('keeps the siblings when clearing one of several other dimensions', () => {
    updateLayer.mockClear()
    const layer = makeLayer([scalarDim({ name: 'band', units: '' })], {
      otherDimensionValues: { band: 'red', reference_time: '2026-06-24T03:00:00.000Z' },
    })
    const { value } = useWmsDimension(layer, 'band')

    value.value = undefined
    expect(updateLayer).toHaveBeenCalledWith(layer, {
      otherDimensionValues: { reference_time: '2026-06-24T03:00:00.000Z' },
    })
  })

  it('offers the enumerated values, and none for an interval', () => {
    const enumerated = useWmsDimension(makeLayer([scalarDim({ values: [0, 10, 20] })]), 'elevation')
    expect(enumerated.options.value).toEqual(['0', '10', '20'])

    const asInterval = useWmsDimension(
      makeLayer([scalarDim({ values: { begin: 0, end: 100, resolution: 10 } })]),
      'elevation',
    )
    expect(asInterval.options.value).toEqual([])
  })

  it('formats a temporal dimension as WMS time, not Date.toString()', () => {
    updateLayer.mockClear()
    const reference: WmsLayerTimeDimension = {
      name: 'reference_time',
      isTime: true,
      values: [new Date('2026-06-24T03:00:00Z')],
      nearestValue: false,
      multipleValues: false,
      current: false,
    }
    const layer = makeLayer([reference])
    const { options, reset } = useWmsDimension(layer, 'reference_time')

    expect(options.value).toEqual(['2026-06-24T03:00:00Z'])
    reset()
    expect(updateLayer).toHaveBeenCalledWith(layer, {
      otherDimensionValues: { reference_time: '2026-06-24T03:00:00Z' },
    })
  })

  it('resets to a declared default of 0 rather than the first value', () => {
    updateLayer.mockClear()
    const layer = makeLayer([scalarDim({ values: [5, 0, 10], defaultValue: 0 })])
    useWmsDimension(layer, 'elevation').reset()

    expect(updateLayer).toHaveBeenCalledWith(layer, { elevationValue: '0' })
  })
})
