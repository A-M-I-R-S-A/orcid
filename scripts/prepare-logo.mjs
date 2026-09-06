#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE = path.join(ROOT, 'logo.png')
const OUTPUT = path.join(ROOT, 'public', 'logo.png')
const FAVICON = path.join(ROOT, 'public', 'icon.png')

async function main() {
  const source = await readFile(SOURCE)

  const original = await sharp(source).metadata()

  const trimmed = await sharp(source)
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })

  await writeFile(OUTPUT, trimmed.data)

  const { width, height } = trimmed.info
  const blossomSize = Math.min(height, Math.round(width * 0.32))

  await sharp(trimmed.data)
    .extract({
      left: Math.max(0, width - blossomSize),
      top: 0,
      width: blossomSize,
      height: Math.min(blossomSize, height),
    })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(FAVICON)

  console.log(`✓ logo   ${original.width}×${original.height} → ${width}×${height}`)
  console.log(`  aspect ${(width / height).toFixed(2)}:1 — at 44px tall it renders ${Math.round((44 * width) / height)}px wide`)
  console.log(`✓ icon   256×256 (blossom crop) → public/icon.png`)
  console.log(`\n  Original untouched at ./logo.png`)
}

main().catch((error) => {
  console.error('✗ Logo preparation failed:', error.message)
  process.exit(1)
})
