import 'server-only'

import { createWriteStream } from 'node:fs'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import path from 'node:path'

import { uploadRoot } from './images'
import { logger } from './logger'
import { collectFiles, tarReadable } from './tar'

const KEEP = 4
const PREFIX = 'orchid-media-'
const EXCLUDED = new Set(['backups', 'logs'])

function archiveDir(): string {
  return process.env.BACKUP_DIR ?? path.join(uploadRoot(), 'backups')
}

export interface MediaBackupResult {
  file: string
  bytes: number
  files: number
  durationMs: number
}

export async function archiveMedia(): Promise<MediaBackupResult> {
  const started = Date.now()
  const root = uploadRoot()
  const dir = archiveDir()
  await mkdir(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(dir, `${PREFIX}${stamp}.tar.gz`)

  const entries = (await collectFiles(root)).filter(
    (entry) => !EXCLUDED.has(entry.name.split('/')[0] ?? ''),
  )

  await pipeline(tarReadable(entries), createGzip({ level: 6 }), createWriteStream(file))

  const { size } = await stat(file)
  await prune(dir)

  const result = { file, bytes: size, files: entries.length, durationMs: Date.now() - started }
  logger.info('media archive written', result)

  return result
}

async function prune(dir: string): Promise<void> {
  const archives = (await readdir(dir))
    .filter((name) => name.startsWith(PREFIX) && name.endsWith('.tar.gz'))
    .sort()
    .reverse()

  for (const stale of archives.slice(KEEP)) {
    await unlink(path.join(dir, stale)).catch(() => {})
  }
}

export async function mediaArchiveAgeHours(): Promise<number | null> {
  try {
    const dir = archiveDir()
    const archives = (await readdir(dir))
      .filter((name) => name.startsWith(PREFIX) && name.endsWith('.tar.gz'))
      .sort()

    const newest = archives[archives.length - 1]
    if (!newest) return null

    const { mtimeMs } = await stat(path.join(dir, newest))
    return (Date.now() - mtimeMs) / 3_600_000
  } catch {
    return null
  }
}
