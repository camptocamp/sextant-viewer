import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AttributeFilterColumn from './AttributeFilterColumn.vue'
import { SEARCH_MAX_LENGTH, type FieldValue, type IndexField } from '@/utils/geonetwork-index'

const field = { esField: 'ft_NAME_s', label: 'Nom' } as IndexField
const valuesOf = (count: number): FieldValue[] =>
  Array.from({ length: count }, (_, i) => ({ value: `v${i}`, count: 1 }))

const SEARCH_INPUT = 'input[placeholder="Rechercher une valeur"]'

function mountColumn(values: FieldValue[], truncated = false, searching = false) {
  return mount(AttributeFilterColumn, {
    props: { field, values, truncated, selected: [], searching },
    global: {
      stubs: {
        Collapsible: {
          template: '<div><slot :open="true" /><slot name="content" /></div>',
        },
      },
    },
  })
}

afterEach(() => vi.useRealTimers())

describe('AttributeFilterColumn', () => {
  it('hides the search input for short, complete value lists', () => {
    const wrapper = mountColumn(valuesOf(3))
    expect(wrapper.find(SEARCH_INPUT).exists()).toBe(false)
  })

  it('keeps the search input once shown, even when results shrink', async () => {
    const wrapper = mountColumn(valuesOf(20))
    expect(wrapper.find(SEARCH_INPUT).exists()).toBe(true)

    await wrapper.setProps({ values: valuesOf(2) })
    expect(wrapper.find(SEARCH_INPUT).exists()).toBe(true)
  })

  it('shows the search input for truncated lists', () => {
    const wrapper = mountColumn(valuesOf(3), true)
    expect(wrapper.find(SEARCH_INPUT).exists()).toBe(true)
  })

  it('emits the trimmed term once typing pauses for 300 ms', async () => {
    vi.useFakeTimers()
    const wrapper = mountColumn(valuesOf(3), true)

    await wrapper.find(SEARCH_INPUT).setValue('  foo  ')
    await vi.advanceTimersByTimeAsync(299)
    expect(wrapper.emitted('search')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.emitted('search')).toEqual([['foo']])
  })

  it('shows a loading state on the input while searching', async () => {
    const wrapper = mountColumn(valuesOf(3), true)
    const spinner = () => wrapper.find('[data-slot="leadingIcon"]').classes()
    expect(spinner()).not.toContain('animate-spin')

    await wrapper.setProps({ searching: true })
    expect(spinner()).toContain('animate-spin')
  })

  it('caps the term length so the generated pattern stays valid', () => {
    const wrapper = mountColumn(valuesOf(3), true)
    expect(wrapper.find(SEARCH_INPUT).attributes('maxlength')).toBe(String(SEARCH_MAX_LENGTH))
  })

  it('keeps the truncation hint while a term is entered', async () => {
    const wrapper = mountColumn(valuesOf(3), true)
    await wrapper.find(SEARCH_INPUT).setValue('v')
    expect(wrapper.text()).toContain('Liste limitée à 3 valeurs')
  })
})
