import { describe, expect, it } from 'vitest'
import type { WpsExecuteOutputResult } from '@camptocamp/ogc-client'
import { classifyOutput } from './useWps'

const reference = (mimeType: string): WpsExecuteOutputResult => ({
  identifier: 'OUTPUT',
  title: 'An output',
  reference: { href: 'https://host/out', mimeType },
})

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
