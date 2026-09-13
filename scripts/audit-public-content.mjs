import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const roots = ['src/app', 'src/components']
const catalogSource = fs.readFileSync('src/lib/site-content.ts', 'utf8')
const catalogKeys = new Set([...catalogSource.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]))
const allowedManagedElsewhere = new Set([
  'ارکید',
  'فروشگاه',
  'راهنما و پشتیبانی',
  'تماس با ما',
  'فروشگاه اینترنتی ارکید؛ لباس زیر زنانه با کیفیت، طراحی ظریف و ارسال محرمانه به سراسر ایران.',
  'ا',
  '٪',
  '٬',
])
const failures = []

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(target) : target.endsWith('.tsx') ? [target] : []
  })
}

for (const file of roots.flatMap(filesIn)) {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.includes('/admin/')) continue
  const source = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hasTAlias = source.includes('const t = useSiteText')

  function visit(node, managed = false) {
    let withinManagedCall = managed
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const isTextCall =
        (ts.isIdentifier(expression) && (expression.text === 'useSiteText' || (hasTAlias && expression.text === 't'))) ||
        (ts.isPropertyAccessExpression(expression) && expression.name.text === 'text')
      if (isTextCall && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        withinManagedCall = true
        if (!catalogKeys.has(node.arguments[0].text)) failures.push(`${file}: unknown content key ${node.arguments[0].text}`)
      }
    }

    if (!withinManagedCall) {
      const value = ts.isJsxText(node)
        ? node.text.trim().replace(/\s+/g, ' ')
        : ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? node.text.trim().replace(/\s+/g, ' ')
          : ''
      if (value && /[آ-ی]/.test(value) && !allowedManagedElsewhere.has(value)) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        failures.push(`${file}:${line}: unmanaged public copy: ${value.slice(0, 120)}`)
      }
    }
    ts.forEachChild(node, (child) => visit(child, withinManagedCall))
  }
  visit(ast)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Public content audit passed (${catalogKeys.size} centralized keys).`)
