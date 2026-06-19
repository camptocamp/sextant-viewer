#!/usr/bin/env node
/**
 * Generates docs/api/SxtViewerElement.md from SxtViewer.ce.vue
 * using @vue/compiler-sfc and the TypeScript compiler API.
 *
 * Called automatically via: npm run docs:dev / docs:build (predocs hook)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { parse: parseSfc } = require('@vue/compiler-sfc')
const ts = require('typescript')

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const SFC_PATH = resolve(root, 'src/components/SxtViewer.ce.vue')
const OUT_PATH = resolve(root, 'docs/api/SxtViewerElement.md')

// ── Parse SFC ────────────────────────────────────────────────────────────────

const sfcSource = readFileSync(SFC_PATH, 'utf-8')
const { descriptor } = parseSfc(sfcSource)
const script = descriptor.scriptSetup.content

const sf = ts.createSourceFile('SxtViewer.ts', script, ts.ScriptTarget.Latest, /* setParentNodes */ true)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toText(comment) {
  if (!comment) return ''
  if (typeof comment === 'string') return comment.trim()
  if (Array.isArray(comment)) {
    return comment
      .map((c) => (typeof c === 'string' ? c : (c.text ?? '')))
      .join('')
      .trim()
  }
  return ''
}

function getJsDoc(node) {
  const docs = node.jsDoc
  return docs?.length ? docs[docs.length - 1] : null
}

function getParamDocs(jsDoc) {
  if (!jsDoc?.tags) return {}
  const result = {}
  for (const tag of jsDoc.tags) {
    if (tag.kind === ts.SyntaxKind.JSDocParameterTag) {
      const name = tag.name?.text ?? tag.name?.right?.text ?? ''
      if (name) result[name] = toText(tag.comment)
    }
  }
  return result
}

// ── Collect arrow function declarations ───────────────────────────────────────

const funcDecls = new Map()
// Destructured declarations (e.g. `const { addLayer } = useAddLayer()`) that carry a JSDoc
const jsdocDecls = new Map()

ts.forEachChild(sf, (node) => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
    const decl = node.declarationList.declarations[0]
    if (ts.isIdentifier(decl.name) && decl.initializer && ts.isArrowFunction(decl.initializer)) {
      funcDecls.set(decl.name.text, { varStatement: node, arrowFunc: decl.initializer })
    } else if (ts.isObjectBindingPattern(decl.name) && getJsDoc(node)) {
      for (const element of decl.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          jsdocDecls.set(element.name.text, node)
        }
      }
    }
  }
})

// ── Find defineExpose ─────────────────────────────────────────────────────────

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
        .filter((p) => ts.isShorthandPropertyAssignment(p))
        .map((p) => p.name.text)
    }
  }
})

// ── Find defineEmits ──────────────────────────────────────────────────────────

const emitsData = []
ts.forEachChild(sf, (node) => {
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0]
    if (
      decl &&
      ts.isIdentifier(decl.name) &&
      decl.name.text === 'emit' &&
      decl.initializer &&
      ts.isCallExpression(decl.initializer) &&
      ts.isIdentifier(decl.initializer.expression) &&
      decl.initializer.expression.text === 'defineEmits'
    ) {
      const typeArg = decl.initializer.typeArguments?.[0]
      if (typeArg && ts.isTypeLiteralNode(typeArg)) {
        for (const member of typeArg.members) {
          if (ts.isPropertySignature(member) && member.type) {
            const eventName = ts.isStringLiteral(member.name)
              ? member.name.text
              : member.name.getText(sf)
            const payloadType = member.type.getText(sf)
            const jsDoc = getJsDoc(member)
            emitsData.push({ name: eventName, payloadType, description: toText(jsDoc?.comment) })
          }
        }
      }
    }
  }
})

// ── Build method signatures ───────────────────────────────────────────────────

function buildMethod(name) {
  const info = funcDecls.get(name)
  if (!info) {
    // Fallback: destructured declaration with JSDoc (e.g. const { addLayer } = useAddLayer())
    const varStatement = jsdocDecls.get(name)
    if (varStatement) {
      const jsDoc = getJsDoc(varStatement)
      const paramDocs = getParamDocs(jsDoc)
      const paramNames = Object.keys(paramDocs)
      const signature = `${name}(${paramNames.join(', ')})`
      return { name, signature, description: toText(jsDoc?.comment), params: paramDocs, arrowFunc: null }
    }
    return { name, signature: `${name}()`, description: '', params: {} }
  }

  const { varStatement, arrowFunc } = info
  const jsDoc = getJsDoc(varStatement)

  const isAsync = arrowFunc.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)

  const paramList = arrowFunc.parameters.map((p) => {
    const paramName = p.name.getText(sf)
    const typeText = p.type ? ': ' + p.type.getText(sf) : ''
    const optional = p.questionToken || p.initializer ? '?' : ''
    return paramName + optional + typeText
  })

  const returnType = arrowFunc.type ? ': ' + arrowFunc.type.getText(sf) : ''
  const signature = `${isAsync ? 'async ' : ''}${name}(${paramList.join(', ')})${returnType}`

  return {
    name,
    signature,
    description: toText(jsDoc?.comment),
    params: getParamDocs(jsDoc),
    arrowFunc,
  }
}

const methods = exposeNames.map(buildMethod)

// ── Render Markdown ────────────────────────────────────────────────────────────

function renderMethod(m) {
  const hasParams = Object.keys(m.params).length > 0
  const paramTable = hasParams
    ? '\n| Paramètre | Description |\n|-----------|-------------|\n' +
      (m.arrowFunc
        ? m.arrowFunc.parameters.map((p) => {
            const pName = p.name.getText(sf)
            const desc = (m.params[pName] ?? '').replace(/^-\s*/, '')
            return `| \`${pName}\` | ${desc} |`
          })
        : Object.entries(m.params).map(([pName, desc]) =>
            `| \`${pName}\` | ${String(desc).replace(/^-\s*/, '')} |`
          )
      ).join('\n') +
      '\n'
    : ''

  return `### \`${m.name}\`

\`\`\`typescript
${m.signature}
\`\`\`

${m.description || '_Aucune description._'}
${paramTable}`
}

const methodsMd = methods.map(renderMethod).join('\n---\n\n')

const eventsMd =
  emitsData.length > 0
    ? '| Événement | Payload | Description |\n|-----------|---------|-------------|\n' +
      emitsData
        .map((e) => `| \`${e.name}\` | \`${e.payloadType}\` | ${e.description} |`)
        .join('\n')
    : '_Aucun événement._'

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

${methodsMd}

## Événements

${eventsMd}

## Props

_Aucune propriété HTML pour le moment — la configuration se fait via les méthodes._

## Variables CSS

_Aucune variable CSS pour le moment._
`

mkdirSync(resolve(root, 'docs/api'), { recursive: true })
writeFileSync(OUT_PATH, output)
console.log('✓ docs/api/SxtViewerElement.md généré')
