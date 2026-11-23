import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AttributeFilterTree from './AttributeFilterTree.vue'
import type { TreeIndexField } from '@/utils/geonetwork-index'

const field: TreeIndexField = {
  esField: 'P',
  label: 'Paramètre',
  aggField: 'ft_P_s_tree',
  type: 'tree',
}

describe('AttributeFilterTree', () => {
  it('names each checkbox after its full path', () => {
    const wrapper = mount(AttributeFilterTree, {
      props: {
        field,
        values: [
          { value: 'x', count: 2 },
          { value: 'x/y', count: 1 },
        ],
        truncated: false,
        selected: [],
        expanded: ['x'],
        searching: false,
      },
      global: {
        stubs: {
          Collapsible: { template: '<div><slot :open="true" /><slot name="content" /></div>' },
        },
      },
    })
    const labels = wrapper.findAll('[role="checkbox"]').map((box) => box.attributes('aria-label'))
    expect(labels).toEqual(['x', 'x/y'])
  })
})
