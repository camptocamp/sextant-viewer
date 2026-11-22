import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OlMap from 'ol/Map'
import DragBox from 'ol/interaction/DragBox'
import { useMapStore } from '@/stores/map.store'
import AttributeFilterBbox from './AttributeFilterBbox.vue'

const Collapsible = defineComponent({
  props: { open: Boolean },
  emits: ['update:open'],
  template: '<div><slot :open="open" /><slot v-if="open" name="content" /></div>',
})

describe('AttributeFilterBbox', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // jsdom lacks it, and the OL map observes its viewport size.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stops an armed drawing when its section collapses', async () => {
    const map = new OlMap({})
    useMapStore().olMap = map
    const dragBoxes = () =>
      map
        .getInteractions()
        .getArray()
        // Exact class: the default DragZoom extends DragBox.
        .filter((interaction) => interaction.constructor === DragBox)
    const wrapper = mount(AttributeFilterBbox, {
      props: { bbox: undefined },
      global: { stubs: { Collapsible } },
    })
    const section = wrapper.findComponent(Collapsible)

    section.vm.$emit('update:open', true)
    await wrapper.vm.$nextTick()
    const drawButton = wrapper.findAll('button').find((b) => b.text() === 'Dessiner sur la carte')
    await drawButton!.trigger('click')
    expect(dragBoxes()).toHaveLength(1)

    section.vm.$emit('update:open', false)
    await wrapper.vm.$nextTick()
    expect(dragBoxes()).toHaveLength(0)
  })
})
