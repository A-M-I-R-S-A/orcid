#!/usr/bin/env node

import { access, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(standalone))) {
  console.error('.next/standalone is missing — run `next build` first.')
  process.exit(1)
}

const targets = [
  { from: join(root, '.next', 'static'), to: join(standalone, '.next', 'static'), label: '.next/static' },
  { from: join(root, 'public'), to: join(standalone, 'public'), label: 'public' },
]

for (const target of targets) {
  if (!(await exists(target.from))) {
    console.log(`  · ${target.label} — not present, skipped`)
    continue
  }

  await rm(target.to, { recursive: true, force: true })
  await cp(target.from, target.to, { recursive: true })
  console.log(`  ✓ ${target.label}`)
}

console.log('\n.next/standalone is complete — `npm start` will serve assets.\n')
