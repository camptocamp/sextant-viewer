import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getLayerByName: vi.fn() }))

vi.mock('@camptocamp/ogc-client', () => ({
  WmsEndpoint: class {
    isReady() {
      return Promise.resolve(this)
    }
    getLayerByName = mocks.getLayerByName
  },
}))

import {
  buildWmsFilterParam,
  enrichWmsDimensionsLayer,
  getDefaultWmsTime,
  getDimensionDefaultOption,
  getDimensionOptions,
  getDimensionUnitLabel,
  getWmsOtherDimensions,
  getWmsTimeDimension,
  toWmsTime,
  type AnyWmsDimension,
} from './wms.utils'
import type { FilterByAttribute } from '@/types/wms.types'
import type { MapLayer } from './layer.utils'
import type { WmsLayerDimension, WmsLayerFull, WmsLayerTimeDimension } from '@camptocamp/ogc-client'

const region = (values: string[]): FilterByAttribute => ({
  attributeName: 'DCSMM_SOUS_REGION',
  matchType: 'equals',
  values,
})
const theme = (values: string[]): FilterByAttribute => ({
  attributeName: 'THEME',
  matchType: 'equals',
  values,
})
const tokenizedTheme = (values: string[]): FilterByAttribute => ({
  attributeName: 'THEME',
  matchType: 'contains',
  values,
})

const NS = 'http://www.opengis.net/ogc'
const filterXml = (body: string) => `<Filter xmlns="${NS}">${body}</Filter>`
const eq = (field: string, value: string) =>
  `<PropertyIsEqualTo><PropertyName>${field}</PropertyName><Literal>${value}</Literal></PropertyIsEqualTo>`
const isLike = (field: string, pattern: string) =>
  `<PropertyIsLike wildCard="*" singleChar="." escapeChar="!">` +
  `<PropertyName>${field}</PropertyName><Literal>${pattern}</Literal></PropertyIsLike>`

describe('buildWmsFilterParam', () => {
  it('returns null without selections', () => {
    expect(buildWmsFilterParam('a,b', [])).toBeNull()
    expect(buildWmsFilterParam('a,b', [region([])])).toBeNull()
    expect(buildWmsFilterParam('a,b', [region([''])])).toBeNull()
  })

  it('skips clauses with an unknown match type instead of throwing', () => {
    const stale = {
      attributeName: 'THEME',
      matchType: 'regex',
      values: ['x'],
    } as unknown as FilterByAttribute
    expect(buildWmsFilterParam('surval_point', [stale, region(['A'])])).toBe(
      filterXml(eq('DCSMM_SOUS_REGION', 'A')),
    )
  })

  it('builds a single PropertyIsEqualTo for an equals attribute', () => {
    expect(buildWmsFilterParam('surval_point', [region(['Manche'])])).toBe(
      filterXml(eq('DCSMM_SOUS_REGION', 'Manche')),
    )
  })

  it('builds a substring PropertyIsLike for a contains (tokenized) attribute', () => {
    expect(buildWmsFilterParam('surval_point', [tokenizedTheme(['Benthos'])])).toBe(
      filterXml(isLike('THEME', '*Benthos*')),
    )
  })

  it('escapes like wildcards occurring in contains values', () => {
    expect(buildWmsFilterParam('surval_point', [tokenizedTheme(['a*b.c!d'])])).toBe(
      filterXml(isLike('THEME', '*a!*b!.c!!d*')),
    )
  })

  it('wraps several values of one attribute in <Or>', () => {
    expect(buildWmsFilterParam('surval_point', [region(['A', 'B'])])).toBe(
      filterXml(`<Or>${eq('DCSMM_SOUS_REGION', 'A')}${eq('DCSMM_SOUS_REGION', 'B')}</Or>`),
    )
  })

  it('AND-combines several attributes', () => {
    expect(buildWmsFilterParam('surval_point', [region(['A']), theme(['M'])])).toBe(
      filterXml(`<And>${eq('DCSMM_SOUS_REGION', 'A')}${eq('THEME', 'M')}</And>`),
    )
  })

  it('XML-escapes the attribute name and values (via CDATA)', () => {
    const field: FilterByAttribute = {
      attributeName: 'A&B',
      matchType: 'equals',
      values: [`a<'&"`],
    }
    expect(buildWmsFilterParam('surval_point', [field])).toBe(
      filterXml(
        `<PropertyIsEqualTo><PropertyName><![CDATA[A&B]]></PropertyName>` +
          `<Literal><![CDATA[a<'&"]]></Literal></PropertyIsEqualTo>`,
      ),
    )
  })

  it('emits one parenthesised <Filter> per sublayer (trimmed)', () => {
    const group = `(${filterXml(eq('DCSMM_SOUS_REGION', 'A'))})`
    expect(buildWmsFilterParam('a, b ,c', [region(['A'])])).toBe(group + group + group)
  })
})

const timeDim = (over: Partial<WmsLayerTimeDimension> = {}): WmsLayerTimeDimension => ({
  name: 'time',
  isTime: true,
  values: [],
  nearestValue: false,
  multipleValues: false,
  current: false,
  ...over,
})

const scalarDim = (over: Partial<WmsLayerDimension> = {}): WmsLayerDimension => ({
  name: 'elevation',
  units: 'meters',
  values: [],
  nearestValue: false,
  multipleValues: false,
  ...over,
})

const wmsLayer = (dims: AnyWmsDimension[]) =>
  ({ type: 'wms', name: 'lyr', extras: { wmsDimensions: dims } }) as unknown as MapLayer

describe('dimension classification', () => {
  it('reads the time dimension whatever casing the server used', () => {
    for (const name of ['time', 'TIME', 'Time']) {
      const layer = wmsLayer([timeDim({ name })])
      expect(getWmsTimeDimension(layer)?.name).toBe(name)
      expect(getWmsOtherDimensions(layer)).toEqual([])
    }
  })

  it('drops a non-temporal dimension named time rather than emitting DIM_TIME', () => {
    const layer = wmsLayer([scalarDim({ name: 'TIME' })])
    expect(getWmsTimeDimension(layer)).toBeNull()
    expect(getWmsOtherDimensions(layer)).toEqual([])
  })

  it('keeps a temporal dimension named otherwise among the other dimensions', () => {
    const reference = timeDim({ name: 'reference_time' })
    const layer = wmsLayer([reference])
    expect(getWmsTimeDimension(layer)).toBeNull()
    expect(getWmsOtherDimensions(layer)).toEqual([reference])
  })
})

describe('toWmsTime', () => {
  it('drops the zero milliseconds two public servers reject', () => {
    expect(toWmsTime(new Date('2026-06-24T03:00:00Z'))).toBe('2026-06-24T03:00:00Z')
  })

  it('leaves a genuine sub-second value alone', () => {
    expect(toWmsTime(new Date('2026-06-24T03:00:00.500Z'))).toBe('2026-06-24T03:00:00.500Z')
  })
})

describe('getDimensionOptions', () => {
  it('formats temporal values as WMS time, never as Date.toString()', () => {
    const dim = timeDim({ name: 'reference_time', values: [new Date('2026-06-24T03:00:00Z')] })
    expect(getDimensionOptions(dim)).toEqual(['2026-06-24T03:00:00Z'])
  })

  it('stringifies scalar values and yields none for an interval', () => {
    expect(getDimensionOptions(scalarDim({ values: [0, -1.5, 'top'] }))).toEqual([
      '0',
      '-1.5',
      'top',
    ])
    expect(
      getDimensionOptions(scalarDim({ values: [{ begin: 0, end: 100, resolution: 10 }] })),
    ).toEqual([])
  })

  it('yields none for a dimension the boundary left empty', () => {
    const dim = scalarDim({ values: [] })
    expect(getDimensionOptions(dim)).toEqual([])
    expect(getDimensionDefaultOption(dim)).toBeUndefined()
    expect(getDefaultWmsTime(timeDim({ values: [] }))).toBeNull()
  })
})

describe('getDimensionDefaultOption', () => {
  it('keeps a declared default of 0, which a truthiness test would drop', () => {
    expect(getDimensionDefaultOption(scalarDim({ values: [0, 10], defaultValue: 0 }))).toBe('0')
  })

  it('falls back to the first enumerable value', () => {
    expect(getDimensionDefaultOption(scalarDim({ values: [5, 10] }))).toBe('5')
  })
})

describe('getDefaultWmsTime', () => {
  it('prefers the declared default', () => {
    const dim = timeDim({
      values: [new Date('2002-01-15T00:00:00Z')],
      defaultValue: new Date('2002-03-15T00:00:00Z'),
    })
    expect(getDefaultWmsTime(dim)?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('falls back to the first date, then to an interval start', () => {
    expect(
      getDefaultWmsTime(timeDim({ values: [new Date('2002-01-15T00:00:00Z')] }))?.toISOString(),
    ).toBe('2002-01-15T00:00:00.000Z')

    const asInterval = [
      {
        begin: new Date('2002-01-15T00:00:00Z'),
        end: new Date('2002-06-15T00:00:00Z'),
        period: { years: 0, months: 1, days: 0, hours: 0, minutes: 0, seconds: 0 },
      },
    ] as unknown as WmsLayerTimeDimension['values']
    expect(getDefaultWmsTime(timeDim({ values: asInterval }))?.toISOString()).toBe(
      '2002-01-15T00:00:00.000Z',
    )
  })
})

describe('getDimensionUnitLabel', () => {
  it('prefers the symbol, and declares none for a temporal dimension', () => {
    expect(getDimensionUnitLabel(scalarDim({ units: 'meters', unitSymbol: 'm' }))).toBe('m')
    expect(getDimensionUnitLabel(scalarDim({ units: 'meters' }))).toBe('meters')
    expect(getDimensionUnitLabel(timeDim({ name: 'reference_time' }))).toBeUndefined()
  })
})

const MONTHLY = { years: 0, months: 1, days: 0, hours: 0, minutes: 0, seconds: 0 }
const NEVER = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }

async function enrich(layerInfo: Partial<WmsLayerFull> | undefined) {
  mocks.getLayerByName.mockReturnValue(layerInfo)
  const layer = { type: 'wms', url: 'https://host/wms', name: 'lyr' } as unknown as MapLayer
  const enriched = (await enrichWmsDimensionsLayer(layer)) as MapLayer & {
    timeValue?: unknown
    extras?: { wmsDimensions?: AnyWmsDimension[] }
  }
  return {
    layer: enriched,
    dimensions: enriched.extras?.wmsDimensions ?? [],
    values: (enriched.extras?.wmsDimensions?.[0]?.values ?? []) as unknown[],
  }
}

// Every reader downstream trusts the dimension model, so this is the one place that has to face
// what ogc-client's types do not say.
describe('enrichWmsDimensionsLayer — the ogc-client boundary', () => {
  beforeEach(() => mocks.getLayerByName.mockReset())

  it('turns the null values of the 1.1.x extent inheritance into an empty list', async () => {
    const { dimensions, values } = await enrich({
      timeDimension: timeDim({ values: null as unknown as WmsLayerTimeDimension['values'] }),
    })
    // Kept, not dropped: a missing `extras.wmsDimensions` key would re-run enrichment every pass.
    expect(dimensions).toHaveLength(1)
    expect(values).toEqual([])
  })

  it('wraps an interval declared on its own into a list', async () => {
    const lone = {
      begin: new Date('2002-01-15T00:00:00Z'),
      end: new Date('2002-06-15T00:00:00Z'),
      period: MONTHLY,
    }
    const { values } = await enrich({
      timeDimension: timeDim({ values: lone as unknown as WmsLayerTimeDimension['values'] }),
    })
    expect(values).toEqual([lone])
  })

  it("revives the ISO strings ogc-client's JSON cache hands back", async () => {
    const fresh = {
      timeDimension: timeDim({
        values: [new Date('2002-01-15T00:00:00Z')],
        defaultValue: new Date('2002-03-15T00:00:00Z'),
      }),
    }
    const cached = JSON.parse(JSON.stringify(fresh)) as Partial<WmsLayerFull>
    const { layer, values } = await enrich(cached)

    expect(values).toEqual([new Date('2002-01-15T00:00:00Z')])
    expect(layer.extras?.wmsDimensions?.[0]?.defaultValue).toEqual(new Date('2002-03-15T00:00:00Z'))
    // The seeded TIME is what the map ends up requesting, and the SDK forwards it verbatim.
    expect(layer.timeValue).toBe('2002-03-15T00:00:00Z')
  })

  it('drops an interval no reader could step through', async () => {
    const { values } = await enrich({
      timeDimension: timeDim({
        values: [
          { begin: null, end: null, period: null },
          { begin: new Date('2002-01-01T00:00:00Z'), end: null, period: MONTHLY },
          // `P0D` parses fine and would step nowhere, expanding to the same instant 3650 times.
          {
            begin: new Date('2002-01-01T00:00:00Z'),
            end: new Date('2002-01-02T00:00:00Z'),
            period: NEVER,
          },
          new Date('2002-02-01T00:00:00Z'),
        ] as unknown as WmsLayerTimeDimension['values'],
      }),
    })
    expect(values).toEqual([new Date('2002-02-01T00:00:00Z')])
  })

  it('normalizes the scalar dimensions alongside the temporal one', async () => {
    const { dimensions } = await enrich({
      elevationDimension: scalarDim({
        values: null as unknown as WmsLayerDimension['values'],
      }),
      otherDimensions: [scalarDim({ name: 'band', values: [1, 2] })],
    })
    expect(dimensions.map((dim) => dim.values)).toEqual([[], [1, 2]])
  })

  it('leaves a layer the server declares no dimension for untouched', async () => {
    const { layer } = await enrich({})
    expect(layer.extras).toBeUndefined()
  })
})
