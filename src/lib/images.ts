import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { AppError, MESSAGES, errors } from './errors'
import { toPersianDigits } from './persian'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_DIMENSION = 6000
const MIN_DIMENSION = 200

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])

import { IMAGE_WIDTHS, renditionPaths } from './media-url'

export type ImageVariant = 'avif' | 'webp' | 'jpeg'

export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? './storage')
}

export function resolveStoredPath(relative: string): string {
  const root = uploadRoot()
  const resolved = path.resolve(root, relative)

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw errors.forbidden('مسیر فایل معتبر نیست.')
  }
  return resolved
}

function randomName(): string {
  return randomBytes(16).toString('hex')
}

export interface ProcessedImage {
  path: string
  width: number
  height: number
  files: string[]
}

export interface UploadOptions {
  folder: 'products' | 'categories' | 'blog' | 'brand' | 'homepage' | 'pages'
  singleSize?: boolean
}

export async function processUpload(
  file: File,
  options: UploadOptions,
): Promise<ProcessedImage> {
  if (file.size > MAX_BYTES) {
    throw new AppError('VALIDATION', MESSAGES.fileTooLarge)
  }
  if (file.size === 0) {
    throw new AppError('VALIDATION', MESSAGES.fileCorrupt)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let image: sharp.Sharp
  let metadata: sharp.Metadata
  try {
    image = sharp(buffer, { failOn: 'error' })
    metadata = await image.metadata()
  } catch {
    throw new AppError('VALIDATION', MESSAGES.fileCorrupt)
  }

  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new AppError('VALIDATION', MESSAGES.fileTypeInvalid)
  }

  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new AppError(
      'VALIDATION',
      `ابعاد تصویر باید حداقل ${toPersianDigits(MIN_DIMENSION)}×${toPersianDigits(MIN_DIMENSION)} پیکسل باشد.`,
    )
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new AppError(
      'VALIDATION',
      `ابعاد تصویر نباید بیش از ${toPersianDigits(MAX_DIMENSION)}×${toPersianDigits(MAX_DIMENSION)} پیکسل باشد.`,
    )
  }

  const name = randomName()
  const dir = path.join(uploadRoot(), options.folder)
  await mkdir(dir, { recursive: true })

  const written: string[] = []

  const fitting = IMAGE_WIDTHS.filter((w) => w <= width)
  const widths: number[] = options.singleSize
    ? [Math.min(width, 1280)]
    : fitting.length > 0
      ? [...fitting]
      : [width]

  try {
    for (const targetWidth of widths) {
      const base = sharp(buffer, { failOn: 'error' })
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })

      const avif = await base.clone().avif({ quality: 55, effort: 4 }).toBuffer()
      const webp = await base.clone().webp({ quality: 78 }).toBuffer()

      const avifRel = path.posix.join(options.folder, `${name}-${targetWidth}.avif`)
      const webpRel = path.posix.join(options.folder, `${name}-${targetWidth}.webp`)

      await writeFile(path.join(uploadRoot(), avifRel), avif)
      written.push(avifRel)
      await writeFile(path.join(uploadRoot(), webpRel), webp)
      written.push(webpRel)
    }

    const jpegRel = path.posix.join(options.folder, `${name}.jpg`)
    const jpeg = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: Math.min(width, 1280), withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    await writeFile(path.join(uploadRoot(), jpegRel), jpeg)
    written.push(jpegRel)

    const primaryWidth = widths[widths.length - 1] ?? width
    const scale = Math.min(1, primaryWidth / width)

    return {
      path: path.posix.join(options.folder, `${name}-${primaryWidth}.webp`),
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      files: written,
    }
  } catch (error) {
    await Promise.all(written.map((rel) => deleteStored(rel).catch(() => {})))
    throw error instanceof AppError ? error : new AppError('VALIDATION', MESSAGES.fileCorrupt)
  }
}

export async function deleteStored(relative: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(relative))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function deleteImageSet(primaryPath: string): Promise<void> {
  await Promise.all(renditionPaths(primaryPath).map((p) => deleteStored(p).catch(() => {})))
}

export {
  IMAGE_WIDTHS,
  buildSrcSet,
  contentTypeFor,
  jpegFallbackUrl,
  mediaUrl,
} from './media-url'
