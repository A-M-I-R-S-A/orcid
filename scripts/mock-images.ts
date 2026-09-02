/**
 * Mock product imagery.
 *
 * Generates placeholder art for the demo catalogue and pushes it through the
 * REAL upload pipeline (`addProductImage` → `processUpload`), so sharp
 * validation, the AVIF/WebP/JPEG derivatives, the `product_images` rows and
 * the primary-image flag are all exercised exactly as an admin upload would
 * be. Nothing here writes image rows to the database by hand.
 *
 * ── What it draws, and why not garments ────────────────────────────────────
 * The first version of this script drew garment outlines. They were bad — a
 * bra rendered as a pair of spectacles — because recognisable figure drawing
 * in hand-authored path data is genuinely hard, and a clumsy outline looks
 * worse than no image at all.
 *
 * So these are DRAPE STUDIES instead: soft-focus folds of fabric in the brand
 * colourways, built from blurred organic forms, a directional sheen and a fine
 * weave. That is achievable well, it reads as premium editorial texture rather
 * than as clip art, and it is unmistakably not a photograph of a product —
 * which matters, because a shopper must never be shown a fabricated "photo" of
 * something they are buying. The shop's own photography replaces these.
 *
 * Usage:
 *   npm run mock:images            skip products that already have images
 *   npm run mock:images -- --force replace existing images
 */

import 'dotenv/config'

import { eq } from 'drizzle-orm'
import sharp from 'sharp'

import { db } from '../src/db'
import { categories, productImages, products } from '../src/db/schema'
import { addProductImage } from '../src/modules/catalog/admin-service'
import { deleteImageSet } from '../src/lib/images'

const force = process.argv.includes('--force')

const WIDTH = 1200
const HEIGHT = 1500

/** Colourways drawn from the brand palette, matching the seeded variants. */
const COLOURWAYS = [
  {
    key: 'مشکی',
    deep: '#17161A',
    mid: '#34313A',
    light: '#5A5560',
    sheen: '#CFC7D2',
  },
  {
    key: 'کرم',
    deep: '#C4AE93',
    mid: '#E2D4C1',
    light: '#F3EBDF',
    sheen: '#FFFDF8',
  },
  {
    key: 'زرشکی',
    deep: '#3E1016',
    mid: '#6E2029',
    light: '#9A3A40',
    sheen: '#E7B9AE',
  },
] as const

type Colourway = (typeof COLOURWAYS)[number]

/**
 * Deterministic pseudo-random, so a given product always produces the same
 * artwork. Re-running must not reshuffle the catalogue's appearance.
 */
function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/**
 * One fold of fabric: a broad, soft-edged sweep. Several of these layered at
 * different scales and opacities is what reads as drape — a single crisp shape
 * reads as a blob, which is why every one is heavily blurred.
 */
function fold(
  rand: () => number,
  colour: string,
  opacity: number,
  blur: number,
): string {
  const y = -60 + rand() * (HEIGHT + 120)
  const amp = 70 + rand() * 380
  const thickness = 90 + rand() * 420
  const tilt = (rand() - 0.5) * 420

  const x0 = -180
  const x1 = WIDTH + 180

  return `
    <path d="
      M ${x0} ${y}
      C ${WIDTH * 0.28} ${y - amp}, ${WIDTH * 0.62} ${y + amp}, ${x1} ${y + tilt}
      L ${x1} ${y + tilt + thickness}
      C ${WIDTH * 0.62} ${y + amp + thickness}, ${WIDTH * 0.28} ${y - amp + thickness}, ${x0} ${y + thickness}
      Z"
      fill="${colour}" opacity="${opacity}" filter="url(#soft${blur})"/>`
}

function composeSvg(colourway: Colourway, seed: number): string {
  const rand = rng(seed)
  const { deep, mid, light, sheen } = colourway

  // Layered back to front: broad dark masses, then mid tones, then the
  // highlights that catch the light.
  const layers = [
    fold(rand, deep, 0.55, 90),
    fold(rand, deep, 0.4, 90),
    fold(rand, mid, 0.5, 60),
    fold(rand, mid, 0.42, 60),
    fold(rand, light, 0.34, 40),
    fold(rand, light, 0.26, 40),
    fold(rand, sheen, 0.2, 40),
    fold(rand, sheen, 0.12, 24),
  ].join('\n')

  const weaveAngle = 18 + (seed % 4) * 12

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="ground" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%"   stop-color="${mid}"/>
      <stop offset="55%"  stop-color="${deep}"/>
      <stop offset="100%" stop-color="${mid}"/>
    </linearGradient>

    <!-- Directional satin highlight. -->
    <linearGradient id="sheen" x1="0" y1="1" x2="0.85" y2="0">
      <stop offset="0%"   stop-color="${sheen}" stop-opacity="0"/>
      <stop offset="42%"  stop-color="${sheen}" stop-opacity="0.16"/>
      <stop offset="55%"  stop-color="${sheen}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${sheen}" stop-opacity="0"/>
    </linearGradient>

    <!-- Three stops, not two: a single ramp from 55% showed as a visible oval
         ring on the light colourway rather than as falloff. -->
    <radialGradient id="vignette" cx="50%" cy="42%" r="95%">
      <stop offset="35%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="72%"  stop-color="#000000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.30"/>
    </radialGradient>

    <filter id="soft90"  x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="90"/></filter>
    <filter id="soft60"  x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="60"/></filter>
    <filter id="soft40"  x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="40"/></filter>
    <filter id="soft24"  x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="24"/></filter>

    <!-- Fine weave, so the surface reads as cloth rather than as a gradient. -->
    <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${weaveAngle})">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/>
      <line x1="0" y1="0" x2="6" y2="0" stroke="#000000" stroke-opacity="0.05"  stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ground)"/>
  ${layers}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sheen)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#weave)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
</svg>`
}

/* ── Run ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('\nOrchid — mock product imagery (drape studies)\n')

  const rows = await db
    .select({ id: products.id, name: products.name, categoryName: categories.name })
    .from(products)
    .leftJoin(categories, eq(products.primaryCategoryId, categories.id))
    .orderBy(products.id)

  if (rows.length === 0) {
    console.log('No products found. Run: npm run db:seed -- --demo')
    return
  }

  let created = 0

  for (const product of rows) {
    const existing = await db
      .select({ id: productImages.id, path: productImages.path })
      .from(productImages)
      .where(eq(productImages.productId, product.id))

    if (existing.length > 0) {
      if (!force) {
        console.log(`  · ${product.name} — already has ${existing.length} image(s), skipping`)
        continue
      }

      for (const image of existing) {
        await db.delete(productImages).where(eq(productImages.id, image.id))
        await deleteImageSet(image.path)
      }
    }

    for (const [index, colourway] of COLOURWAYS.entries()) {
      const svg = composeSvg(colourway, product.id * 17 + index * 101)

      /*
       * Rasterise before handing over. processUpload validates by DECODING the
       * file and accepts jpeg/png/webp/avif — not SVG, deliberately, since SVG
       * can carry script. Producing a PNG means the mock passes through
       * exactly the same validation as a real upload rather than around it.
       */
      const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

      const file = new File([new Uint8Array(png)], `drape-${index}.png`, { type: 'image/png' })

      await addProductImage(
        product.id,
        file,
        // Descriptive alt, as §72 requires — an empty alt on a product image
        // is an accessibility failure, not a neutral choice.
        `${product.name} — نمای پارچه، رنگ ${colourway.key}`,
      )

      created++
    }

    console.log(`  ✓ ${product.name} — ${COLOURWAYS.length} images`)
  }

  console.log(`\n✓ ${created} images generated through the real upload pipeline.\n`)
}

main()
  .catch((error) => {
    console.error('\n✗ Failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    const { pool } = await import('../src/db')
    await pool.end()
  })
