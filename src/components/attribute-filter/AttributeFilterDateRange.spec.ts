import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DateRangeIndexField } from '@/utils/geonetwork-index'
import AttributeFilterDateRange from './AttributeFilterDateRange.vue'

const field: DateRangeIndexField = {
  esField: 'D',
  label: 'Date',
  type: 'dateRange',
  minField: 'DMIN',
  maxField: 'DMAX',
}

describe('AttributeFilterDateRange', () => {
  const initialTz = process.env.TZ

  // West of UTC, where parsing a day as UTC midnight then formatting it locally gives the day before.
  beforeEach(() => {
    process.env.TZ = 'America/Guadeloupe'
  })
  afterEach(() => {
    process.env.TZ = initialTz
  })

  it('shows the index bounds as the same days in any time zone', () => {
    const wrapper = mount(AttributeFilterDateRange, {
      props: { field, bounds: { min: '2024-03-01', max: '2024-12-31' }, selected: undefined },
      global: {
        stubs: {
          Collapsible: { template: '<div><slot :open="true" /><slot name="content" /></div>' },
        },
      },
    })
    expect(wrapper.text()).toContain('Données du 01/03/2024 au 31/12/2024.')
  })
})
