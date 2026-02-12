import { EXAMPLES } from './examples/index.js'

const exampleSelector = document.getElementById('example-selector')
const exampleDoc = document.getElementById('example-doc')
const codeInputEl = document.getElementById('code-input')
const runBtn = document.getElementById('run-btn')

EXAMPLES.forEach((example, index) => {
  const option = document.createElement('option')
  option.value = index
  option.textContent = example.name
  exampleSelector.appendChild(option)
})

const showExample = async (index) => {
  const example = EXAMPLES[index]
  if (example) {
    codeInputEl.value = example.code
    exampleDoc.innerHTML = example.description
  }
}
exampleSelector.addEventListener('change', (e) => {
  const selectedIndex = parseInt(e.target.value)
  sessionStorage.setItem('selectedExampleIndex', selectedIndex)
  showExample(selectedIndex)
})

// Restore selection from sessionStorage or the first one (useful for dev)
const savedIndex = sessionStorage.getItem('selectedExampleIndex')
const initialIndex = savedIndex ? parseInt(savedIndex) : 0
exampleSelector.value = initialIndex
showExample(initialIndex)

function execCode() {
  const code = codeInputEl.value
  const execFn = new Function(code)
  execFn()
}

runBtn.addEventListener('click', execCode)
