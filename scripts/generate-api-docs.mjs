#!/usr/bin/env node
/**
 * Generates docs/api/SxtViewerElement.md from SxtViewer.ce.vue
 * using @vue/compiler-sfc and the TypeScript compiler API.
 *
 * Called automatically via: npm run docs:dev / docs:build (predocs hook)
 *
 * Strategy:
 *   1. Parse the <script setup> block with the TypeScript compiler.
 *   2. Collect all arrow-function declarations by name, plus destructured
 *      composable calls that carry a JSDoc (e.g. `const { addLayer } = useAddLayer()`),
 *      for lookup.
 *   3. Find defineExpose({ name1, name2, ... }) to know the public API surface.
 *      defineExpose only gives us names — we cross-reference with (2) to get
 *      the full signature and JSDoc for each exposed method.
 *   4. Find defineEmits<{ … }>() to extract event names and payload types
 *      directly from the type argument (no runtime value to inspect).
 *   5. Render everything as Markdown.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// @vue/compiler-sfc and typescript are CJS packages; createRequire lets us
// import them from this ESM script without a full transpile step.
const require = createRequire(import.meta.url)
const { parse: parseSfc } = require('@vue/compiler-sfc')
const ts = require('typescript')

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const SFC_PATH = resolve(root, 'src/components/SxtViewer.ce.vue')
const OUT_PATH = resolve(root, 'docs/api/SxtViewerElement.md')

// ── 1. Parse SFC ──────────────────────────────────────────────────────────────

const sfcSource = readFileSync(SFC_PATH, 'utf-8')
const { descriptor } = parseSfc(sfcSource)
const scriptContent = descriptor.scriptSetup.content

// sf = SourceFile — the root node of the TypeScript AST
const sf = ts.createSourceFile('SxtViewer.ts', scriptContent, ts.ScriptTarget.Latest, /* setParentNodes */ true)

// ── JSDoc helpers ─────────────────────────────────────────────────────────────

function getJsDoc(node) {
  return node.jsDoc?.at(-1) ?? null
}

// JSDoc comments can be a plain string or an array of text/link nodes.
function jsDocCommentToText(comment) {
  if (!comment) return ''
  if (typeof comment === 'string') return comment.trim()
  if (Array.isArray(comment)) {
    return comment.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join('').trim()
  }
  return ''
}

// Returns { paramName: description } from @param tags in a JSDoc block.
function getParamDescriptions(jsDoc) {
  const result = {}
  for (const tag of jsDoc?.tags ?? []) {
    if (tag.kind !== ts.SyntaxKind.JSDocParameterTag) continue
    const name = tag.name?.text ?? tag.name?.right?.text ?? ''
    if (name) result[name] = jsDocCommentToText(tag.comment)
  }
  return result
}

// ── 2. Collect arrow-function and JSDoc-annotated destructured declarations ───
// We build two maps so that step 3 can look up any exposed method's signature
// and JSDoc by name:
//   - arrowFunctionsByName: regular `const foo = (...) => ...` declarations
//   - jsdocDecls:           destructured calls like `const { addLayer } = useAddLayer()`
//                           that carry a JSDoc block (signature is inferred from
//                           @param tags since no arrow function body is present)

const arrowFunctionsByName = new Map()
const jsdocDecls = new Map()

ts.forEachChild(sf, (node) => {
  if (!ts.isVariableStatement(node)) return
  const decl = node.declarationList.declarations[0]
  if (decl && ts.isIdentifier(decl.name) && decl.initializer && ts.isArrowFunction(decl.initializer)) {
    arrowFunctionsByName.set(decl.name.text, { statement: node, fn: decl.initializer })
  } else if (decl && ts.isObjectBindingPattern(decl.name) && getJsDoc(node)) {
    for (const element of decl.name.elements) {
      if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
        jsdocDecls.set(element.name.text, node)
      }
    }
  }
})

// ── 3. Find defineExpose ──────────────────────────────────────────────────────
// defineExpose({ addLayer, getContext, … }) lists only names; the actual
// signatures come from the arrow-function lookup above.

let exposeNames = []
ts.forEachChild(sf, (node) => {
  if (
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'defineExpose'
  ) {
    const arg = node.expression.arguments[0]
    if (arg && ts.isObjectLiteralExpression(arg)) {
      exposeNames = arg.properties
        .filter(ts.isShorthandPropertyAssignment)
        .map((p) => p.name.text)
    }
  }
})

// ── 4. Find defineEmits ───────────────────────────────────────────────────────
// defineEmits uses a TypeScript type literal (no runtime value), so we read
// the event names and payload types from the generic type argument.

const emits = []
ts.forEachChild(sf, (node) => {
  if (!ts.isVariableStatement(node)) return
  const decl = node.declarationList.declarations[0]
  if (
    !decl ||
    !ts.isIdentifier(decl.name) ||
    decl.name.text !== 'emit' ||
    !decl.initializer ||
    !ts.isCallExpression(decl.initializer) ||
    !ts.isIdentifier(decl.initializer.expression) ||
    decl.initializer.expression.text !== 'defineEmits'
  )
    return

  const typeArg = decl.initializer.typeArguments?.[0]
  if (!typeArg || !ts.isTypeLiteralNode(typeArg)) return

  for (const member of typeArg.members) {
    if (!ts.isPropertySignature(member) || !member.type) continue
    const name = ts.isStringLiteral(member.name) ? member.name.text : member.name.getText(sf)
    emits.push({
      name,
      payloadType: member.type.getText(sf),
      description: jsDocCommentToText(getJsDoc(member)?.comment),
    })
  }
})

// ── 5. Build method signatures ────────────────────────────────────────────────

function buildMethod(name) {
  const info = arrowFunctionsByName.get(name)
  if (!info) {
    // Fallback: destructured declaration with JSDoc (e.g. const { addLayer } = useAddLayer())
    const statement = jsdocDecls.get(name)
    if (statement) {
      const jsDoc = getJsDoc(statement)
      const paramDescriptions = getParamDescriptions(jsDoc)
      const paramNames = Object.keys(paramDescriptions)
      const signature = `${name}(${paramNames.join(', ')})`
      return { name, signature, description: jsDocCommentToText(jsDoc?.comment), paramDescriptions, fn: null }
    }
    return { name, signature: `${name}()`, description: '', paramDescriptions: {}, fn: null }
  }

  const { statement, fn } = info
  const jsDoc = getJsDoc(statement)
  const isAsync = fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)

  const paramList = fn.parameters.map((p) => {
    const paramName = p.name.getText(sf)
    const type = p.type ? ': ' + p.type.getText(sf) : ''
    const optional = p.questionToken || p.initializer ? '?' : ''
    return paramName + optional + type
  })

  const returnType = fn.type ? ': ' + fn.type.getText(sf) : ''
  const signature = `${isAsync ? 'async ' : ''}${name}(${paramList.join(', ')})${returnType}`

  return {
    name,
    signature,
    description: jsDocCommentToText(jsDoc?.comment),
    paramDescriptions: getParamDescriptions(jsDoc),
    fn,
  }
}

const methods = exposeNames.map(buildMethod)

// ── 6. Render Markdown ────────────────────────────────────────────────────────

function renderParamTable(method) {
  if (Object.keys(method.paramDescriptions).length === 0) return ''
  const rows = method.fn
    ? method.fn.parameters.map((p) => {
        const name = p.name.getText(sf)
        const desc = (method.paramDescriptions[name] ?? '').replace(/^-\s*/, '')
        return `| \`${name}\` | ${desc} |`
      })
    : Object.entries(method.paramDescriptions).map(([name, desc]) =>
        `| \`${name}\` | ${String(desc).replace(/^-\s*/, '')} |`
      )
  return ['', '| Paramètre | Description |', '|-----------|-------------|', ...rows, ''].join('\n')
}

function renderMethod(method) {
  return `### \`${method.name}\`

\`\`\`typescript
${method.signature}
\`\`\`

${method.description || '_Aucune description._'}
${renderParamTable(method)}`
}

function renderEventsTable() {
  if (emits.length === 0) return '_Aucun événement._'
  const rows = emits.map((e) => `| \`${e.name}\` | \`${e.payloadType}\` | ${e.description} |`)
  return ['| Événement | Payload | Description |', '|-----------|---------|-------------|', ...rows].join('\n')
}

const output = `---
aside: false
---

# SxtViewerElement

Référence de l'API du web component \`<sxt-viewer>\`.

Obtenir une référence à l'élément puis appeler ses méthodes :

\`\`\`html
<sxt-viewer id="viewer"></sxt-viewer>
<script type="module">
  const viewer = document.getElementById('viewer')
  await viewer.setInitialContext({ layers: [], view: { center: [2.35, 48.85], zoom: 10 } })
</script>
\`\`\`

## Méthodes

${methods.map(renderMethod).join('\n---\n\n')}

## Événements

${renderEventsTable()}

## Props

_Aucune propriété HTML pour le moment — la configuration se fait via les méthodes._

## Variables CSS

_Aucune variable CSS pour le moment._
`

mkdirSync(resolve(root, 'docs/api'), { recursive: true })
writeFileSync(OUT_PATH, output)
console.log('✓ docs/api/SxtViewerElement.md généré')
