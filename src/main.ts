import { defineCustomElement } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import SxtViewer from './components/SxtViewer.ce.vue'
import mainCss from './assets/main.css?inline'

// From https://github.com/tailwindlabs/tailwindcss/issues/15005#issuecomment-2737489813
// copying all initial values from Tailwind's @property rules
const shadowSheet = new CSSStyleSheet()
shadowSheet.replaceSync(mainCss)
const properties = []
for (const rule of shadowSheet.cssRules) {
  if (rule instanceof CSSPropertyRule && rule.initialValue) {
    properties.push(`${rule.name}: ${rule.initialValue}`)
  }
}

const finalStyles = `
${mainCss}
:host {
  ${properties.join(';\n')}
}`

const SxtViewerElement = defineCustomElement(SxtViewer, {
  configureApp(app) {
    const pinia = createPinia()
    app.use(pinia)
    app.use(ui)
  },
  styles: [finalStyles],
})
customElements.define('sxt-viewer', SxtViewerElement)
