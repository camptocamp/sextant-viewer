import { describe, expect, it } from 'vitest'
import { dayAfter } from './date.utils'

describe('dayAfter', () => {
  it('rolls over months and leap days', () => {
    expect(dayAfter('2020-01-31')).toBe('2020-02-01')
    expect(dayAfter('2024-02-28')).toBe('2024-02-29')
    expect(dayAfter('2023-12-31')).toBe('2024-01-01')
  })
})
