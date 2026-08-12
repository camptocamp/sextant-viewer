import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  WpsEndpoint,
  WpsExecuteOptions,
  WpsExecuteOutputResult,
  WpsProcessFull,
  WpsProcessInput,
} from '@camptocamp/ogc-client'
import type { WpsFormInputs, WpsFormOutput, WpsInputOccurrence } from '@/types/wps.types'
import {
  buildExecuteOptions,
  cardinalityLabel,
  classifyOutput,
  executeProcess,
  isBooleanInput,
  isNativeTemporalValue,
  normalizeTemporalLiteral,
  occurrenceHasContent,
  parseBooleanLiteral,
  parseBbox,
  temporalInputType,
  toInputValue,
} from './wps.utils'

const reference = (mimeType: string): WpsExecuteOutputResult => ({
  identifier: 'OUTPUT',
  title: 'An output',
  reference: { href: 'https://host/out', mimeType },
})

const input = (partial: Partial<WpsProcessInput> & Pick<WpsProcessInput, 'identifier' | 'type'>) =>
  ({ minOccurs: 1, maxOccurs: 1, ...partial }) as WpsProcessInput

const process = (inputs: WpsProcessInput[], partial: Partial<WpsProcessFull> = {}) =>
  ({
    identifier: 'buffer',
    statusSupported: false,
    storeSupported: false,
    inputs,
    outputs: [],
    ...partial,
  }) as WpsProcessFull

const build = (
  inputs: WpsProcessInput[],
  formInputs: WpsFormInputs,
  formOutputs: WpsFormOutput[] = [],
  partial: Partial<WpsProcessFull> = {},
) => buildExecuteOptions(process(inputs, partial), formInputs, formOutputs)

describe('classifyOutput', () => {
  it('classifies a WMS reference as a wms layer', () => {
    const result = classifyOutput(reference('application/x-ogc-wms'))
    expect(result).toMatchObject({ kind: 'wms', href: 'https://host/out' })
  })

  it('classifies a geo+json reference as a geojson layer by url', () => {
    const result = classifyOutput(reference('application/geo+json'))
    expect(result).toMatchObject({ kind: 'geojson', url: 'https://host/out' })
  })

  it('classifies inline geo+json as a geojson layer by data', () => {
    const result = classifyOutput({
      identifier: 'OUTPUT',
      data: { mimeType: 'application/geo+json', content: '{"type":"FeatureCollection"}' },
    })
    expect(result).toMatchObject({ kind: 'geojson', data: '{"type":"FeatureCollection"}' })
  })

  it('carries the mimeType on a geojson output, so it can also be downloaded', () => {
    const result = classifyOutput(reference('application/geo+json'))
    expect(result).toMatchObject({
      kind: 'geojson',
      url: 'https://host/out',
      mimeType: 'application/geo+json',
    })
  })

  it('classifies generic application/json as geometry (faithful to Sextant)', () => {
    const result = classifyOutput(reference('application/json'))
    expect(result).toMatchObject({ kind: 'geojson', url: 'https://host/out' })
  })

  it('classifies an opaque octet-stream as a download', () => {
    const result = classifyOutput(reference('application/octet-stream'))
    expect(result).toMatchObject({ kind: 'download', href: 'https://host/out' })
  })

  it('classifies text/csv as a download', () => {
    const result = classifyOutput(reference('text/csv'))
    expect(result.kind).toBe('download')
  })

  it('starts a layer output pending on the map, and a download with no map status', () => {
    expect(classifyOutput(reference('application/x-ogc-wms')).mapStatus).toBe('pending')
    expect(classifyOutput(reference('application/geo+json')).mapStatus).toBe('pending')
    expect(classifyOutput(reference('text/csv')).mapStatus).toBeUndefined()
  })

  it('uses identifier as label when title is absent', () => {
    const result = classifyOutput({ identifier: 'OUTPUT', reference: { href: 'h', mimeType: '' } })
    expect(result.label).toBe('OUTPUT')
  })
})

describe('parseBbox', () => {
  it('parses four comma-separated coordinates', () => {
    expect(parseBbox('1,2,3,4')).toEqual([1, 2, 3, 4])
  })

  it('trims the whitespace around each coordinate', () => {
    expect(parseBbox(' 1 , 2 ,3 , 4 ')).toEqual([1, 2, 3, 4])
  })

  it('accepts negative and decimal coordinates', () => {
    expect(parseBbox('-5.5,-1,0,2.25')).toEqual([-5.5, -1, 0, 2.25])
  })

  it.each([
    ['too few coordinates', '1,2,3'],
    ['too many coordinates', '1,2,3,4,5'],
    ['a non-numeric coordinate', '1,2,3,abc'],
    ['a missing coordinate', '1,2,,4'],
    ['a blank coordinate', '1,2, ,4'],
    ['an empty string', ''],
  ])('rejects %s', (_case, value) => {
    expect(parseBbox(value)).toBeNull()
  })

  it('keeps a zero coordinate', () => {
    expect(parseBbox('0,2,3,4')).toEqual([0, 2, 3, 4])
  })
})

describe('occurrenceHasContent', () => {
  it.each([
    ['a literal value', { literalValue: '10' }],
    ['complex content', { complexContent: '{}' }],
    ['a bbox string', { bboxValue: '1,2,3,4' }],
  ])('reports %s as content', (_case, occurrence) => {
    expect(occurrenceHasContent(occurrence)).toBe(true)
  })

  it('reports a malformed bbox as content, so the form can flag it rather than drop it', () => {
    expect(occurrenceHasContent({ bboxValue: '1,2,3' })).toBe(true)
  })

  it.each([
    ['an untouched occurrence', {}],
    ['a blanked field', { literalValue: '' }],
  ])('reports %s as empty', (_case, occurrence) => {
    expect(occurrenceHasContent(occurrence)).toBe(false)
  })
})

describe('isBooleanInput', () => {
  const literal = (dataType?: string) =>
    input({ identifier: 'BOOL', type: 'literal', literalData: { dataType } })

  it.each([['boolean'], ['xs:boolean'], ['Boolean']])('recognises the %s data type', (dataType) => {
    expect(isBooleanInput(literal(dataType))).toBe(true)
  })

  it.each([
    ['another data type', literal('string')],
    ['an undeclared data type', literal(undefined)],
    ['a non-literal input', input({ identifier: 'EXTENT', type: 'boundingbox' })],
  ])('rejects %s', (_case, value) => {
    expect(isBooleanInput(value)).toBe(false)
  })
})

describe('parseBooleanLiteral', () => {
  it.each([['true'], ['TRUE'], [' true '], ['1']])('reads %s as true', (value) => {
    expect(parseBooleanLiteral(value)).toBe(true)
  })

  it.each([['false'], ['False'], ['0']])('reads %s as false', (value) => {
    expect(parseBooleanLiteral(value)).toBe(false)
  })

  // Unset is not false: it is what lets an optional boolean stay out of the request.
  it.each([
    ['an absent value', undefined],
    ['an empty string', ''],
    ['an unparsable value', 'peut-être'],
  ])('reads %s as unset', (_case, value) => {
    expect(parseBooleanLiteral(value)).toBeUndefined()
  })
})

describe('temporalInputType', () => {
  const literal = (dataType?: string) =>
    input({ identifier: 'WHEN', type: 'literal', literalData: { dataType } })

  it.each([
    ['date', 'date'],
    ['xs:date', 'date'],
    ['Date', 'date'],
    ['dateTime', 'datetime-local'],
    ['xs:dateTime', 'datetime-local'],
    ['DATETIME', 'datetime-local'],
    ['http://www.w3.org/TR/xmlschema-2/#dateTime', 'datetime-local'],
    ['urn:ogc:def:dataType:OGC:1.1:dateTime', 'datetime-local'],
    ['time', 'time'],
    ['xs:time', 'time'],
  ])('maps the %s data type to a %s field', (dataType, expected) => {
    expect(temporalInputType(literal(dataType))).toBe(expected)
  })

  // The whole reason detection matches the local name instead of a substring: 'dateTime'
  // contains 'time', and a naive test would offer an hour picker for a full timestamp.
  it('does not read dateTime as a time', () => {
    expect(temporalInputType(literal('dateTime'))).not.toBe('time')
  })

  it.each([
    ['a string', literal('string')],
    ['a number', literal('double')],
    ['a duration', literal('xs:duration')],
    ['an undeclared data type', literal(undefined)],
    ['a non-literal input', input({ identifier: 'EXTENT', type: 'boundingbox' })],
  ])('offers no temporal field for %s', (_case, value) => {
    expect(temporalInputType(value)).toBeNull()
  })
})

describe('isNativeTemporalValue', () => {
  // An unfilled field is not a malformed one — it must keep its picker.
  it('accepts an empty value for every type', () => {
    expect(isNativeTemporalValue('date', '')).toBe(true)
    expect(isNativeTemporalValue('datetime-local', '')).toBe(true)
    expect(isNativeTemporalValue('time', '')).toBe(true)
  })

  it.each([
    ['date', '2026-08-07'],
    ['datetime-local', '2026-08-07T14:30'],
    ['datetime-local', '2026-08-07T14:30:45'],
    ['time', '14:30'],
    ['time', '14:30:45.5'],
  ] as const)('accepts %s for a %s field', (type, value) => {
    expect(isNativeTemporalValue(type, value)).toBe(true)
  })

  // A zone-qualified default is the realistic case: datetime-local refuses it, so the field
  // must fall back to text rather than silently show nothing.
  it.each([
    ['datetime-local', '2026-08-07T00:00:00Z'],
    ['datetime-local', '2026-08-07T00:00:00+02:00'],
    ['date', '07/08/2026'],
    ['date', '2026-08-07T14:30'],
    ['time', '2 heures'],
  ] as const)('rejects %s for a %s field', (type, value) => {
    expect(isNativeTemporalValue(type, value)).toBe(false)
  })
})

describe('normalizeTemporalLiteral', () => {
  const literal = (dataType: string) =>
    input({ identifier: 'WHEN', type: 'literal', literalData: { dataType } })

  // xs:time and xs:dateTime both require seconds, which the native widget omits at its
  // default step — a strict server rejects the shorter form.
  it('completes the seconds a time field leaves out', () => {
    expect(normalizeTemporalLiteral(literal('time'), '14:30')).toBe('14:30:00')
  })

  it('completes the seconds a datetime field leaves out', () => {
    expect(normalizeTemporalLiteral(literal('dateTime'), '2026-08-07T14:30')).toBe(
      '2026-08-07T14:30:00',
    )
  })

  it.each([
    ['an already complete time', literal('time'), '14:30:45'],
    ['a date, which has no seconds to complete', literal('date'), '2026-08-07'],
    ['a zone-qualified value it cannot read', literal('dateTime'), '2026-08-07T14:30Z'],
    ['a non-temporal input whose value looks like a time', literal('string'), '14:30'],
  ])('leaves %s untouched', (_case, value, literalValue) => {
    expect(normalizeTemporalLiteral(value, literalValue)).toBe(literalValue)
  })
})

describe('cardinalityLabel', () => {
  const cardinality = (minOccurs: number, maxOccurs: number) =>
    cardinalityLabel(input({ identifier: 'IN', type: 'literal', minOccurs, maxOccurs }))

  it('says nothing about an input accepting exactly one value', () => {
    expect(cardinality(1, 1)).toBeNull()
    expect(cardinality(0, 1)).toBeNull()
  })

  it('gives only the upper bound for an optional repeatable input', () => {
    expect(cardinality(0, 3)).toBe("jusqu'à 3 valeurs")
  })

  it('gives both bounds for a required repeatable input', () => {
    expect(cardinality(2, 5)).toBe('de 2 à 5 valeurs')
  })

  it('gives only the lower bound for an unbounded input', () => {
    expect(cardinality(1, Infinity)).toBe('1 valeur minimum')
    expect(cardinality(3, Infinity)).toBe('3 valeurs minimum')
  })

  it('states no bound for an optional unbounded input', () => {
    expect(cardinality(0, Infinity)).toBe('plusieurs valeurs possibles')
  })
})

describe('toInputValue', () => {
  const occurrence = (partial: WpsInputOccurrence) => partial

  describe('literal inputs', () => {
    it('maps the literal value', () => {
      const result = toInputValue(
        input({ identifier: 'DIST', type: 'literal' }),
        occurrence({ literalValue: '10' }),
      )
      expect(result).toEqual({ identifier: 'DIST', literalValue: '10' })
    })

    // The native picker yields 'HH:mm', which is not a valid xs:time — the request builder is
    // where that gets fixed, so validation and the sent value never disagree.
    it('completes the seconds of a temporal literal', () => {
      const result = toInputValue(
        input({ identifier: 'TIME', type: 'literal', literalData: { dataType: 'time' } }),
        occurrence({ literalValue: '14:30' }),
      )
      expect(result).toEqual({ identifier: 'TIME', literalValue: '14:30:00' })
    })

    it('sends a date literal as typed', () => {
      const result = toInputValue(
        input({ identifier: 'DATE', type: 'literal', literalData: { dataType: 'date' } }),
        occurrence({ literalValue: '2026-08-07' }),
      )
      expect(result).toEqual({ identifier: 'DATE', literalValue: '2026-08-07' })
    })

    it('keeps a value that is falsy as a number but not as a string', () => {
      const result = toInputValue(
        input({ identifier: 'DIST', type: 'literal' }),
        occurrence({ literalValue: '0' }),
      )
      expect(result).toEqual({ identifier: 'DIST', literalValue: '0' })
    })

    it('returns null for an empty value', () => {
      const result = toInputValue(
        input({ identifier: 'DIST', type: 'literal' }),
        occurrence({ literalValue: '' }),
      )
      expect(result).toBeNull()
    })
  })

  describe('complex inputs', () => {
    it('uses the mime type declared as the input default', () => {
      const result = toInputValue(
        input({
          identifier: 'GEOM',
          type: 'complex',
          complexData: { default: { mimeType: 'application/gml+xml' }, supported: [] },
        }),
        occurrence({ complexContent: '<gml:Point/>' }),
      )
      expect(result).toEqual({
        identifier: 'GEOM',
        complexValue: { mimeType: 'application/gml+xml', content: '<gml:Point/>' },
      })
    })

    it('falls back to application/json when the input declares no format', () => {
      const result = toInputValue(
        input({ identifier: 'GEOM', type: 'complex' }),
        occurrence({ complexContent: '{}' }),
      )
      expect(result).toEqual({
        identifier: 'GEOM',
        complexValue: { mimeType: 'application/json', content: '{}' },
      })
    })

    it('returns null for empty content', () => {
      const result = toInputValue(
        input({ identifier: 'GEOM', type: 'complex' }),
        occurrence({ complexContent: '' }),
      )
      expect(result).toBeNull()
    })
  })

  describe('bounding box inputs', () => {
    const bboxInput = input({
      identifier: 'BBOX',
      type: 'boundingbox',
      boundingBoxData: { defaultCrs: 'EPSG:4326', supportedCrs: ['EPSG:4326'] },
    })

    it('carries the parsed bbox and the default CRS', () => {
      const result = toInputValue(bboxInput, occurrence({ bboxValue: '1,2,3,4' }))
      expect(result).toEqual({
        identifier: 'BBOX',
        boundingBoxValue: { crs: 'EPSG:4326', bbox: [1, 2, 3, 4] },
      })
    })

    it('leaves the CRS undefined when the input declares none', () => {
      const result = toInputValue(
        input({ identifier: 'BBOX', type: 'boundingbox' }),
        occurrence({ bboxValue: '1,2,3,4' }),
      )
      expect(result).toEqual({
        identifier: 'BBOX',
        boundingBoxValue: { crs: undefined, bbox: [1, 2, 3, 4] },
      })
    })

    it('returns null when the bbox cannot be parsed', () => {
      expect(toInputValue(bboxInput, occurrence({ bboxValue: '1,2,3' }))).toBeNull()
    })

    it('returns null for an empty bbox', () => {
      expect(toInputValue(bboxInput, occurrence({ bboxValue: '' }))).toBeNull()
    })
  })

  it('returns null for an occurrence holding no value at all', () => {
    expect(toInputValue(input({ identifier: 'DIST', type: 'literal' }), occurrence({}))).toBeNull()
  })

  it.each([
    ['literal', occurrence({ complexContent: '{}' })],
    ['complex', occurrence({ literalValue: '10' })],
    ['boundingbox', occurrence({ literalValue: '10' })],
  ])('returns null when the occurrence field does not match a %s input', (type, value) => {
    const result = toInputValue(
      input({ identifier: 'IN', type: type as WpsProcessInput['type'] }),
      value,
    )
    expect(result).toBeNull()
  })
})

describe('buildExecuteOptions', () => {
  describe('literal inputs', () => {
    it('maps an occurrence to a literal value', () => {
      const options = build([input({ identifier: 'DIST', type: 'literal' })], {
        DIST: [{ literalValue: '10' }],
      })
      expect(options.inputs).toEqual([{ identifier: 'DIST', literalValue: '10' }])
    })

    it('emits one entry per occurrence of a repeatable input', () => {
      const options = build([input({ identifier: 'DIST', type: 'literal', maxOccurs: 3 })], {
        DIST: [{ literalValue: '10' }, { literalValue: '20' }],
      })
      expect(options.inputs).toEqual([
        { identifier: 'DIST', literalValue: '10' },
        { identifier: 'DIST', literalValue: '20' },
      ])
    })

    it('skips occurrences left empty by the form', () => {
      const options = build([input({ identifier: 'DIST', type: 'literal', maxOccurs: 2 })], {
        DIST: [{ literalValue: '' }, { literalValue: '10' }],
      })
      expect(options.inputs).toEqual([{ identifier: 'DIST', literalValue: '10' }])
    })

    it('skips an input the form never filled', () => {
      const options = build([input({ identifier: 'DIST', type: 'literal' })], {})
      expect(options.inputs).toEqual([])
    })

    it('sends an unchecked required boolean rather than dropping it', () => {
      const options = build(
        [input({ identifier: 'BOOL', type: 'literal', literalData: { dataType: 'boolean' } })],
        { BOOL: [{ literalValue: 'false' }] },
      )
      expect(options.inputs).toEqual([{ identifier: 'BOOL', literalValue: 'false' }])
    })

    it('omits an optional boolean left unset, so the process applies its own default', () => {
      const options = build(
        [
          input({
            identifier: 'BOOL',
            type: 'literal',
            minOccurs: 0,
            literalData: { dataType: 'boolean' },
          }),
        ],
        { BOOL: [{}] },
      )
      expect(options.inputs).toEqual([])
    })
  })

  describe('complex inputs', () => {
    it('uses the mime type declared as the input default', () => {
      const options = build(
        [
          input({
            identifier: 'GEOM',
            type: 'complex',
            complexData: { default: { mimeType: 'application/gml+xml' }, supported: [] },
          }),
        ],
        { GEOM: [{ complexContent: '<gml:Point/>' }] },
      )
      expect(options.inputs).toEqual([
        {
          identifier: 'GEOM',
          complexValue: { mimeType: 'application/gml+xml', content: '<gml:Point/>' },
        },
      ])
    })

    it('falls back to application/json when the process declares no format', () => {
      const options = build([input({ identifier: 'GEOM', type: 'complex' })], {
        GEOM: [{ complexContent: '{}' }],
      })
      expect(options.inputs[0]?.complexValue?.mimeType).toBe('application/json')
    })
  })

  describe('bounding box inputs', () => {
    const bboxInput = input({
      identifier: 'BBOX',
      type: 'boundingbox',
      boundingBoxData: { defaultCrs: 'EPSG:4326', supportedCrs: ['EPSG:4326'] },
    })

    it('parses the comma-separated string and carries the default CRS', () => {
      const options = build([bboxInput], { BBOX: [{ bboxValue: '1,2,3,4' }] })
      expect(options.inputs).toEqual([
        { identifier: 'BBOX', boundingBoxValue: { crs: 'EPSG:4326', bbox: [1, 2, 3, 4] } },
      ])
    })

    it('tolerates spaces around the coordinates', () => {
      const options = build([bboxInput], { BBOX: [{ bboxValue: ' 1 , 2 , 3 , 4 ' }] })
      expect(options.inputs[0]?.boundingBoxValue?.bbox).toEqual([1, 2, 3, 4])
    })

    it('drops a bbox that has the wrong number of coordinates', () => {
      const options = build([bboxInput], { BBOX: [{ bboxValue: '1,2,3' }] })
      expect(options.inputs).toEqual([])
    })

    it('drops a bbox holding a non-numeric coordinate', () => {
      const options = build([bboxInput], { BBOX: [{ bboxValue: '1,2,3,abc' }] })
      expect(options.inputs).toEqual([])
    })
  })

  it('ignores an occurrence whose value does not match the input type', () => {
    const options = build([input({ identifier: 'DIST', type: 'literal' })], {
      DIST: [{ complexContent: '{}' }],
    })
    expect(options.inputs).toEqual([])
  })

  it('follows the process input order, not the form key order', () => {
    const options = build(
      [
        input({ identifier: 'A', type: 'literal' }),
        input({ identifier: 'B', type: 'literal' }),
        input({ identifier: 'C', type: 'literal' }),
      ],
      { C: [{ literalValue: '3' }], A: [{ literalValue: '1' }], B: [{ literalValue: '2' }] },
    )
    expect(options.inputs.map((i) => i.identifier)).toEqual(['A', 'B', 'C'])
  })

  it('passes the selected outputs through unchanged', () => {
    const options = build([], {}, [
      { identifier: 'RESULT', selected: true, mimeType: 'application/geo+json', asReference: true },
      { identifier: 'REPORT', selected: true, asReference: false },
    ])
    expect(options.outputs).toEqual([
      { identifier: 'RESULT', mimeType: 'application/geo+json', asReference: true },
      { identifier: 'REPORT', mimeType: undefined, asReference: false },
    ])
  })

  it('drops the outputs the user unticked', () => {
    const options = build([], {}, [
      { identifier: 'RESULT', selected: true, mimeType: 'application/geo+json', asReference: true },
      { identifier: 'REPORT', selected: false, mimeType: 'text/plain', asReference: false },
    ])
    expect(options.outputs).toEqual([
      { identifier: 'RESULT', mimeType: 'application/geo+json', asReference: true },
    ])
  })

  it('mirrors the async capabilities advertised by the process', () => {
    expect(build([], {}, [], { storeSupported: true, statusSupported: true })).toMatchObject({
      storeExecuteResponse: true,
      status: true,
    })
    expect(build([], {}, [], { storeSupported: false, statusSupported: false })).toMatchObject({
      storeExecuteResponse: false,
      status: false,
    })
  })
})

describe('executeProcess', () => {
  afterEach(() => vi.useRealTimers())

  const POLL_INTERVAL = 1000

  // A service that answers 'started' forever, which is what an unbounded poll loop would follow
  // until the tab is closed.
  const neverEnding = () => {
    const started = { status: 'started', statusLocation: 'https://host/status', outputs: [] }
    return {
      execute: vi.fn().mockResolvedValue(started),
      getStatus: vi.fn().mockResolvedValue(started),
    } as unknown as WpsEndpoint
  }

  const options = {} as WpsExecuteOptions

  it('gives up on a process that never reaches a terminal status', async () => {
    vi.useFakeTimers()
    const endpoint = neverEnding()

    const run = executeProcess(endpoint, 'demo', options)
    const rejects = expect(run).rejects.toThrow('suivi abandonné après 5 minutes')
    await vi.advanceTimersByTimeAsync(5 * 60_000 + POLL_INTERVAL)
    await rejects
  })

  it('stops polling as soon as the caller aborts', async () => {
    vi.useFakeTimers()
    const endpoint = neverEnding()
    const controller = new AbortController()

    const run = executeProcess(endpoint, 'demo', options, { signal: controller.signal })
    const rejects = expect(run).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL)
    controller.abort()
    await rejects

    // The run is over, not merely unawaited: nothing keeps hitting the service.
    const polled = vi.mocked(endpoint.getStatus).mock.calls.length
    await vi.advanceTimersByTimeAsync(10 * POLL_INTERVAL)
    expect(endpoint.getStatus).toHaveBeenCalledTimes(polled)
  })
})
