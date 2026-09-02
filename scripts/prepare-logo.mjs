#!/usr/bin/env node
/**
 * Logo preparation.
 *
 * The supplied `logo.png` is a 2000×2000 square whose artwork occupies only a
 * 1246×398 band in the middle — the rest is transparent padding. Rendered at
 * `h-11` the mark would be about 9px tall: a smudge.
 *
 * This trims the padding and writes `public/logo.png`. It is the SAME artwork,
 * not a redesign (§50) — only the empty margin is removed, which is what makes
 * the aspect ratio usable in a header.
 *
 * The untouched original stays at the repository root. Re-run after replacing
 * it:
 *
 *   node scripts/prepare-logo.mjs
 */

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

  // A low threshold so anti-aliased edges of the script wordmark survive the
  // trim — too aggressive and the thin strokes lose their tips.
  const trimmed = await sharp(source)
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })

  await writeFile(OUTPUT, trimmed.data)

  /**
   * Favicon: a square crop of the orchid bloom rather than the whole wordmark.
   * The full 3:1 lockup squeezed into 32×32 is illegible — at that size only
   * the flower reads.
   */
  const { width, height } = trimmed.info
  const blossomSize = Math.min(height, Math.round(width * 0.32))

  await sharp(trimmed.data)
    .extract({
      // The bloom sits at the end of the wordmark, which in this artwork is
      // the right-hand side.
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
