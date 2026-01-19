import { defineCustomElement } from 'vue'
import { createPinia } from 'pinia'
import SxtViewer from './components/SxtViewer.ce.vue'
import styles from './assets/main.css?inline'

// From https://github.com/tailwindlabs/tailwindcss/issues/15005#issuecomment-2737489813
const shadowSheet = new CSSStyleSheet()
shadowSheet.replaceSync(styles)
const properties = []
for (const rule of shadowSheet.cssRules) {
  if (rule instanceof CSSPropertyRule) {
    if (rule.initialValue) {
      properties.push(`${rule.name}: ${rule.initialValue}`)
    }
  }
}
// shadowSheet.insertRule(`:host { ${properties.join('; ')} }`);

// console.log(properties);

const nuxtUiColors = {
  primary: '99 102 241',
  secondary: '100 116 139',
  success: '34 197 94',
  warning: '245 158 11',
  error: '239 68 68',
}

let nuxtUiVars = ':host {\n'
for (const [key, value] of Object.entries(nuxtUiColors)) {
  nuxtUiVars += `  --ui-${key}: ${value};\n`
}
nuxtUiVars += '}\n'

let nuxtUiClasses = ''
for (const color of Object.keys(nuxtUiColors)) {
  // Background classes
  nuxtUiClasses += `.bg-${color} { background-color: rgb(var(--ui-${color})); }\n`
  nuxtUiClasses += `.bg-${color}\\/10 { background-color: rgb(var(--ui-${color}) / 0.1); }\n`
  nuxtUiClasses += `.bg-${color}\\/50 { background-color: rgb(var(--ui-${color}) / 0.5); }\n`

  // Text classes
  nuxtUiClasses += `.text-${color} { color: rgb(var(--ui-${color})); }\n`
  nuxtUiClasses += `.text-${color}\\/50 { color: rgb(var(--ui-${color}) / 0.5); }\n`
  nuxtUiClasses += `.text-${color}\\/10 { color: rgb(var(--ui-${color}) / 0.1); }\n`
}

let finalStyles = styles
if (properties.length) {
  finalStyles += `
:host {
  ${properties.join(';\n')}
}
`
}

finalStyles += `
${nuxtUiVars}
${nuxtUiClasses}
`

const SxtViewerElement = defineCustomElement(SxtViewer, {
  configureApp(app) {
    const pinia = createPinia()
    app.use(pinia)
  },
  styles: [finalStyles],
})
customElements.define('sxt-viewer', SxtViewerElement)
