/**
 * Media URL helpers — pure, no filesystem, no `server-only`.
 *
 * These live apart from lib/images.ts deliberately. Building a URL or a srcset
 * is something CLIENT components legitimately do (the gallery, the cart line,
 * the admin product editor), while reading and writing files is strictly
 * server work. Keeping them together would drag sharp and node:fs into the
 * client bundle — which is what the `server-only` guard exists to prevent.
 *
 * For the same reason this module does NOT import `node:path`: webpack cannot
 * resolve node: schemes for the browser. Stored paths are always POSIX-style
 * relative strings we generate ourselves ("products/<hex>-640.webp"), so plain
 * string handling is both sufficient and honest about the shape.
 */

/** Responsive widths generated once at upload, never per request. */
export const IMAGE_WIDTHS = [360, 640, 960, 1280, 1920] as const

/** "products/abc-640.webp" → { dir: "products", base: "abc" } */
function splitStoredPath(storedPath: string): { dir: string; base: string } {
  const slash = storedPath.lastIndexOf('/')
  const dir = slash === -1 ? '' : storedPath.slice(0, slash)
  const filename = slash === -1 ? storedPath : storedPath.slice(slash + 1)
  return { dir, base: filename.replace(/-\d+\.webp$/, '') }
}

function join(dir: string, filename: string): string {
  return dir ? `${dir}/${filename}` : filename
}

/** Public URL for a stored path. Served by the media route handler. */
export function mediaUrl(relative: string): string {
  return `/api/media/${relative}`
}

/**
 * Builds a srcset across the renditions that were ACTUALLY generated.
 *
 * `maxWidth` is the stored image width. Filtering by it matters: processUpload
 * never upscales, so listing a 1920w candidate for a 900px source would point
 * the browser at a file that does not exist.
 */
export function buildSrcSet(
  primaryPath: string,
  maxWidth: number,
  format: 'avif' | 'webp' = 'webp',
): string {
  const { dir, base } = splitStoredPath(primaryPath)

  const widths = IMAGE_WIDTHS.filter((w) => w <= maxWidth)
  const usable: number[] = widths.length > 0 ? [...widths] : [maxWidth]

  return usable
    .map((w) => `${mediaUrl(join(dir, `${base}-${w}.${format}`))} ${w}w`)
    .join(', ')
}

export function jpegFallbackUrl(primaryPath: string): string {
  const { dir, base } = splitStoredPath(primaryPath)
  return mediaUrl(join(dir, `${base}.jpg`))
}

/** Every rendition path for one image, used when deleting the whole set. */
export function renditionPaths(primaryPath: string): string[] {
  const { dir, base } = splitStoredPath(primaryPath)

  const paths = [join(dir, `${base}.jpg`)]
  for (const w of IMAGE_WIDTHS) {
    paths.push(join(dir, `${base}-${w}.avif`))
    paths.push(join(dir, `${base}-${w}.webp`))
  }
  return paths
}

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  ico: 'image/x-icon',
}

/**
 * Content type from extension, for the media route handler.
 * Returns null for anything not on the list — the handler 404s rather than
 * guessing, so an unexpected file can never be served as something executable.
 */
export function contentTypeFor(filePath: string): string | null {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return null
  return CONTENT_TYPES[filePath.slice(dot + 1).toLowerCase()] ?? null
}
