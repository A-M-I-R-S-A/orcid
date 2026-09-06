import 'server-only'

import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

const BLOCK = 512
const NAME_MAX = 100

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0'
}

function header(name: string, size: number, mtime: Date): Buffer {
  const block = Buffer.alloc(BLOCK)

  block.write(name, 0, 100, 'utf8')
  block.write(octal(0o644, 8), 100, 8, 'ascii')
  block.write(octal(0, 8), 108, 8, 'ascii')
  block.write(octal(0, 8), 116, 8, 'ascii')
  block.write(octal(size, 12), 124, 12, 'ascii')
  block.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 12, 'ascii')
  block.write('        ', 148, 8, 'ascii')
  block.write('0', 156, 1, 'ascii')
  block.write('ustar\0', 257, 6, 'ascii')
  block.write('00', 263, 2, 'ascii')

  let sum = 0
  for (const byte of block) sum += byte
  block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')

  return block
}

function padding(size: number): Buffer {
  const remainder = size % BLOCK
  return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - remainder)
}

export interface TarEntry {
  name: string
  absolutePath: string
  size: number
  mtime: Date
}

export async function collectFiles(root: string, prefix = ''): Promise<TarEntry[]> {
  const entries: TarEntry[] = []

  for (const item of await readdir(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, item.name)
    const name = prefix ? `${prefix}/${item.name}` : item.name

    if (item.isDirectory()) {
      entries.push(...(await collectFiles(absolutePath, name)))
      continue
    }
    if (!item.isFile()) continue

    const info = await stat(absolutePath)
    entries.push({ name, absolutePath, size: info.size, mtime: info.mtime })
  }

  return entries
}

export async function* tarStream(entries: TarEntry[]): AsyncGenerator<Buffer> {
  for (const entry of entries) {
    if (Buffer.byteLength(entry.name, 'utf8') > NAME_MAX) {
      throw new Error(
        `Path too long for ustar (${NAME_MAX} bytes): ${entry.name}. ` +
          `This writer does not implement the prefix-field split.`,
      )
    }

    yield header(entry.name, entry.size, entry.mtime)

    for await (const chunk of createReadStream(entry.absolutePath)) {
      yield chunk as Buffer
    }

    const pad = padding(entry.size)
    if (pad.length > 0) yield pad
  }

  yield Buffer.alloc(BLOCK * 2)
}

export function tarReadable(entries: TarEntry[]): Readable {
  return Readable.from(tarStream(entries))
}
