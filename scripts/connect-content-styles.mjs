import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const roots = ['src/app', 'src/components']

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return filesIn(target)
    return target.endsWith('.tsx') ? [target] : []
  })
}

for (const file of roots.flatMap(filesIn)) {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.includes('/admin/')) continue

  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const variables = new Map()
  const edits = []

  function keyFromCall(node) {
    if (!ts.isCallExpression(node) || !node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) return null
    const expression = node.expression
    if (ts.isIdentifier(expression) && (expression.text === 'useSiteText' || (expression.text === 't' && source.includes('const t = useSiteText')))) return node.arguments[0].text
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === 'content' && expression.name.text === 'text') return node.arguments[0].text
    return null
  }

  function insideStyledText(node) {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'SiteStyledText') return true
    }
    return false
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const key = keyFromCall(node.initializer)
      if (key) variables.set(node.name.text, key)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)

  function collect(node) {
    const parentTag = ts.isJsxElement(node.parent) ? node.parent.openingElement.tagName.getText(ast) : ''
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && !['option', 'title', 'textarea'].includes(parentTag) && !insideStyledText(node)) {
      const key = keyFromCall(node.expression) ?? (ts.isIdentifier(node.expression) ? variables.get(node.expression.text) : null)
      if (key) {
        const expression = node.expression.getText(ast)
        edits.push({ start: node.getStart(ast), end: node.getEnd(), text: `<SiteStyledText contentKey="${key}">{${expression}}</SiteStyledText>` })
      }
    }
    ts.forEachChild(node, collect)
  }
  collect(ast)

  if (edits.length === 0) continue
  let next = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)
  if (!next.includes("import { SiteStyledText } from '@/components/site-content-provider'")) {
    const directive = next.startsWith("'use client'") ? next.indexOf('\n', next.indexOf('\n') + 1) + 1 : 0
    next = next.slice(0, directive) + "import { SiteStyledText } from '@/components/site-content-provider'\n" + next.slice(directive)
  }
  fs.writeFileSync(file, next)
}
