import { describe, expect, it } from 'vitest'
import type { WpsProcessFull, WpsProcessInput } from '@camptocamp/ogc-client'
import type { WpsApplicationProfile, WpsFormInputs } from '@/types/wps.types'
import { applyProfile, linkedFilterValues, profileOutputMimeType } from './wps-profile.utils'

const input = (
  partial: Partial<WpsProcessInput> & Pick<WpsProcessInput, 'identifier'>,
): WpsProcessInput =>
  ({ type: 'literal', minOccurs: 1, maxOccurs: 1, ...partial }) as WpsProcessInput

const process = (inputs: WpsProcessInput[]): WpsProcessFull =>
  ({ identifier: 'extraction', inputs, outputs: [] }) as unknown as WpsProcessFull

describe('linkedFilterValues', () => {
  it('gives one value per selection', () => {
    expect(
      linkedFilterValues(
        { identifier: 'theme', linkedWfsFilter: 'THEME' },
        {
          THEME: ['Nutriments', 'Phytoplancton'],
        },
      ),
    ).toEqual(['Nutriments', 'Phytoplancton'])
  })

  it('joins the selections into a single value when tokenized', () => {
    expect(
      linkedFilterValues(
        {
          identifier: 'theme',
          linkedWfsFilter: 'THEME',
          tokenizeWfsFilterValues: true,
          wfsFilterValuesDelimiter: ';',
        },
        { THEME: ['Nutriments', 'Phytoplancton'] },
      ),
    ).toEqual(['Nutriments;Phytoplancton'])
  })

  it('defaults the join delimiter to a comma', () => {
    expect(
      linkedFilterValues(
        { identifier: 'theme', linkedWfsFilter: 'THEME', tokenizeWfsFilterValues: true },
        {
          THEME: ['a', 'b'],
        },
      ),
    ).toEqual(['a,b'])
  })

  it('reads index 0 for a `.from` suffix and index 1 for `.to`', () => {
    const filters = { range_Date: ['2020-01-01', '2021-12-31'] }
    expect(
      linkedFilterValues({ identifier: 'date_min', linkedWfsFilter: 'range_Date.from' }, filters),
    ).toEqual(['2020-01-01'])
    expect(
      linkedFilterValues({ identifier: 'date_max', linkedWfsFilter: 'range_Date.to' }, filters),
    ).toEqual(['2021-12-31'])
  })

  it('yields nothing for a range bound the filter does not hold', () => {
    expect(
      linkedFilterValues(
        { identifier: 'date_max', linkedWfsFilter: 'range_Date.to' },
        {
          range_Date: ['2020-01-01'],
        },
      ),
    ).toEqual([])
  })

  it('yields nothing for an absent or empty column', () => {
    expect(linkedFilterValues({ identifier: 'theme', linkedWfsFilter: 'THEME' }, {})).toEqual([])
    expect(
      linkedFilterValues({ identifier: 'theme', linkedWfsFilter: 'THEME' }, { THEME: [] }),
    ).toEqual([])
  })

  it('yields nothing for an input the profile does not link', () => {
    expect(linkedFilterValues({ identifier: 'theme' }, { THEME: ['a'] })).toEqual([])
  })
})

describe('applyProfile', () => {
  const base: WpsFormInputs = { theme: [{}], count: [{ literalValue: '10' }] }

  it('turns each linked value into its own occurrence', () => {
    const { inputs, overridden } = applyProfile(
      process([input({ identifier: 'theme', maxOccurs: 5 })]),
      base,
      { inputs: [{ identifier: 'theme', linkedWfsFilter: 'THEME' }] },
      { THEME: ['a', 'b'] },
    )
    expect(inputs.theme).toEqual([{ literalValue: 'a' }, { literalValue: 'b' }])
    expect(overridden).toEqual(new Set(['theme']))
  })

  it('caps the occurrences at maxOccurs', () => {
    const { inputs } = applyProfile(
      process([input({ identifier: 'theme', maxOccurs: 2 })]),
      base,
      { inputs: [{ identifier: 'theme', linkedWfsFilter: 'THEME' }] },
      { THEME: ['a', 'b', 'c'] },
    )
    expect(inputs.theme).toEqual([{ literalValue: 'a' }, { literalValue: 'b' }])
  })

  it('prefers a linked value over the profile default', () => {
    const { inputs } = applyProfile(
      process([input({ identifier: 'theme' })]),
      base,
      { inputs: [{ identifier: 'theme', linkedWfsFilter: 'THEME', defaultValue: 'fallback' }] },
      { THEME: ['a'] },
    )
    expect(inputs.theme).toEqual([{ literalValue: 'a' }])
  })

  it('falls back to the profile default when the filter holds nothing', () => {
    const { inputs, overridden } = applyProfile(
      process([input({ identifier: 'theme' })]),
      base,
      { inputs: [{ identifier: 'theme', linkedWfsFilter: 'THEME', defaultValue: 'fallback' }] },
      {},
    )
    expect(inputs.theme).toEqual([{ literalValue: 'fallback' }])
    // Nothing was overridden by the filter, so the field stays editable.
    expect(overridden).toEqual(new Set())
  })

  it('prefers the profile default over what the process declared', () => {
    const { inputs } = applyProfile(
      process([input({ identifier: 'count' })]),
      base,
      { inputs: [{ identifier: 'count', defaultValue: '50' }] },
      {},
    )
    expect(inputs.count).toEqual([{ literalValue: '50' }])
  })

  it('leaves the base value alone when the profile names no default', () => {
    const { inputs } = applyProfile(
      process([input({ identifier: 'count' })]),
      base,
      { inputs: [{ identifier: 'count', hidden: true }] },
      {},
    )
    expect(inputs.count).toEqual([{ literalValue: '10' }])
  })

  it('leaves an input the profile ignores untouched — a profile is not a whitelist', () => {
    const { inputs, hidden, overridden } = applyProfile(
      process([input({ identifier: 'count' })]),
      base,
      { inputs: [{ identifier: 'elsewhere', hidden: true }] },
      {},
    )
    expect(inputs).toEqual(base)
    expect(hidden).toEqual(new Set())
    expect(overridden).toEqual(new Set())
  })

  it('collects the hidden inputs, linked or not', () => {
    const { hidden } = applyProfile(
      process([input({ identifier: 'theme' }), input({ identifier: 'count' })]),
      base,
      {
        inputs: [
          { identifier: 'theme', linkedWfsFilter: 'THEME', hidden: true },
          { identifier: 'count', hidden: true },
        ],
      },
      { THEME: ['a'] },
    )
    expect(hidden).toEqual(new Set(['theme', 'count']))
  })

  it('carries the value on the field matching the input type', () => {
    const { inputs } = applyProfile(
      process([
        input({ identifier: 'limits', type: 'boundingbox' }),
        input({ identifier: 'geom', type: 'complex' }),
      ]),
      {},
      {
        inputs: [
          { identifier: 'limits', linkedWfsFilter: 'geometry' },
          { identifier: 'geom', defaultValue: '{"type":"Point"}' },
        ],
      },
      { geometry: ['-5,47,-3,49'] },
    )
    expect(inputs.limits).toEqual([{ bboxValue: '-5,47,-3,49' }])
    expect(inputs.geom).toEqual([{ complexContent: '{"type":"Point"}' }])
  })

  it('is a no-op without a profile', () => {
    const { inputs, hidden, overridden } = applyProfile(
      process([input({ identifier: 'count' })]),
      base,
      undefined,
      {},
    )
    expect(inputs).toEqual(base)
    expect(hidden.size).toBe(0)
    expect(overridden.size).toBe(0)
  })
})

describe('profileOutputMimeType', () => {
  const profile: WpsApplicationProfile = {
    outputs: [
      { identifier: 'result', defaultMimeType: 'application/zip' },
      { identifier: 'report' },
    ],
  }

  it('matches by identifier', () => {
    expect(profileOutputMimeType(profile, 'result')).toBe('application/zip')
  })

  it('returns undefined for an output naming no mime type', () => {
    expect(profileOutputMimeType(profile, 'report')).toBeUndefined()
  })

  it('returns undefined for an unknown identifier, or a profile with no outputs', () => {
    expect(profileOutputMimeType(profile, 'nope')).toBeUndefined()
    expect(profileOutputMimeType({ inputs: [] }, 'result')).toBeUndefined()
    expect(profileOutputMimeType(undefined, 'result')).toBeUndefined()
  })
})
