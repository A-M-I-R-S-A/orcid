export const IMAGE_WIDTHS = [360, 640, 960, 1280, 1920] as const

function splitStoredPath(storedPath: string): { dir: string; base: string } {
  const slash = storedPath.lastIndexOf('/')
  const dir = slash === -1 ? '' : storedPath.slice(0, slash)
  const filename = slash === -1 ? storedPath : storedPath.slice(slash + 1)
  return { dir, base: filename.replace(/-\d+\.webp$/, '') }
}

function join(dir: string, filename: string): string {
  return dir ? `${dir}/${filename}` : filename
}

export function mediaUrl(relative: string): string {
  return `/api/media/${relative}`
}

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

export function storedWidth(primaryPath: string, fallback = 1280): number {
  const match = primaryPath.match(/-(\d{2,5})\.(?:webp|avif|jpe?g|png)$/i)
  const width = match ? Number(match[1]) : Number.NaN
  return Number.isFinite(width) && width > 0 ? width : fallback
}

export function jpegFallbackUrl(primaryPath: string): string {
  const { dir, base } = splitStoredPath(primaryPath)
  return mediaUrl(join(dir, `${base}.jpg`))
}

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

export function contentTypeFor(filePath: string): string | null {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return null
  return CONTENT_TYPES[filePath.slice(dot + 1).toLowerCase()] ?? null
}
