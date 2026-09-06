import 'server-only'

import { appendFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

import { uploadRoot } from './images'

const MAX_BYTES = 5 * 1024 * 1024
const KEEP_FILES = 5
const FILE = 'orchid.log'

export type LogLevel = 'info' | 'warn' | 'error'

function logDir(): string {
  return process.env.LOG_DIR ?? path.join(uploadRoot(), 'logs')
}

let queue: Promise<void> = Promise.resolve()

async function rotateIfNeeded(dir: string, file: string): Promise<void> {
  let size = 0
  try {
    size = (await stat(file)).size
  } catch {
    return
  }

  if (size < MAX_BYTES) return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await rename(file, `${file}.${stamp}`)

  const entries = (await readdir(dir))
    .filter((name) => name.startsWith(`${FILE}.`))
    .sort()
    .reverse()

  for (const stale of entries.slice(KEEP_FILES)) {
    await unlink(path.join(dir, stale)).catch(() => {})
  }
}

export function log(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  const line =
    JSON.stringify({
      t: new Date().toISOString(),
      level,
      message,
      ...fields,
    }) + '\n'

  queue = queue
    .then(async () => {
      const dir = logDir()
      const file = path.join(dir, FILE)

      await mkdir(dir, { recursive: true })
      await rotateIfNeeded(dir, file)
      await appendFile(file, line, 'utf8')
    })
    .catch(() => {
      process.stderr.write('[logger] write failed — falling back to stdout only\n')
    })
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => log('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log('error', message, fields),
}
