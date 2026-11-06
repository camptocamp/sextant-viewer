import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AttributeFilterColumn from './AttributeFilterColumn.vue'
import type { FieldValue, IndexField } from '@/utils/geonetwork-index'

const field = { esField: 'ft_NAME_s', label: 'Nom' } as IndexField
const valuesOf = (count: number): FieldValue[] =>
  Array.from({ length: count }, (_, i) => ({ value: `v${i}`, count: 1 }))

function mountColumn(values: FieldValue[], truncated = false) {
  return mount(AttributeFilterColumn, {
    props: { field, values, truncated, selected: [], searching: false },
    global: {
      stubs: {
        Collapsible: {
          template: '<div><slot :open="true" /><slot name="content" /></div>',
        },
        Input: { template: '<input class="search" />' },
      },
    },
  })
}

describe('AttributeFilterColumn', () => {
  it('hides the search input for short, complete value lists', () => {
    const wrapper = mountColumn(valuesOf(3))
    expect(wrapper.find('.search').exists()).toBe(false)
  })

  it('keeps the search input once shown, even when results shrink', async () => {
    const wrapper = mountColumn(valuesOf(20))
    expect(wrapper.find('.search').exists()).toBe(true)

    await wrapper.setProps({ values: valuesOf(2) })
    expect(wrapper.find('.search').exists()).toBe(true)
  })

  it('shows the search input for truncated lists', () => {
    const wrapper = mountColumn(valuesOf(3), true)
    expect(wrapper.find('.search').exists()).toBe(true)
  })
})
