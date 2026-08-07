import { describe, expect, it } from 'vitest'
import type {
  WpsExecuteOutputResult,
  WpsProcessFull,
  WpsProcessInput,
} from '@camptocamp/ogc-client'
import type { WpsFormInputs, WpsFormOutput, WpsInputOccurrence } from '@/types/wps.types'
import { buildExecuteOptions, classifyOutput, parseBbox, toInputValue } from './wps.utils'

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
      { identifier: 'RESULT', mimeType: 'application/geo+json', asReference: true },
      { identifier: 'REPORT', asReference: false },
    ])
    expect(options.outputs).toEqual([
      { identifier: 'RESULT', mimeType: 'application/geo+json', asReference: true },
      { identifier: 'REPORT', mimeType: undefined, asReference: false },
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
