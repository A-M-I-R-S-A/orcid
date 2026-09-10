import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { collectFiles, tarReadable } from '@/lib/tar'

const run = promisify(execFile)

const tarHelp = await run('tar', ['--help']).catch(() => null)
const hasTar = tarHelp !== null
const forceLocalSupported = tarHelp?.stdout.includes('--force-local') ?? false
const TAR = (args: string[]) =>
  run('tar', [...(forceLocalSupported ? ['--force-local'] : []), ...args])

describe('ustar writer', () => {
  let workspace: string
  let source: string
  let archive: string

  const files: Record<string, string> = {
    'a.txt': 'x'.repeat(512),
    'b.txt': 'hello',
    'empty.txt': '',
    'nested/persian.txt': 'سوتین بدون فنر نخی — کیفیت عالی',
    'nested/deeper/c.bin': 'y'.repeat(1000),
  }

  beforeAll(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), 'orchid-tar-'))
    source = path.join(workspace, 'src')
    archive = path.join(workspace, 'out.tar.gz')

    for (const [name, content] of Object.entries(files)) {
      const full = path.join(source, name)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, content, 'utf8')
    }

    const entries = await collectFiles(source)
    await pipeline(tarReadable(entries), createGzip(), createWriteStream(archive))
  })

  afterAll(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it('collects every file with POSIX-separated relative names', async () => {
    const entries = await collectFiles(source)
    expect(entries.map((e) => e.name).sort()).toEqual(Object.keys(files).sort())
    for (const entry of entries) expect(entry.name).not.toContain('\\')
  })

  it('refuses a path too long for ustar rather than truncating it', async () => {
    const entries = [
      { name: 'z'.repeat(101), absolutePath: path.join(source, 'b.txt'), size: 5, mtime: new Date() },
    ]

    await expect(
      pipeline(tarReadable(entries), createWriteStream(path.join(workspace, 'bad.tar'))),
    ).rejects.toThrow(/too long for ustar/)
  })

  it.skipIf(!hasTar)('produces an archive the installed tar can list', async () => {
    const { stdout } = await TAR(['-tzf', archive])
    const listed = stdout.split('\n').map((l) => l.trim()).filter(Boolean).sort()

    expect(listed).toEqual(Object.keys(files).sort())
  })

  it.skipIf(!hasTar)('extracts byte-identically, Persian content included', async () => {
    const out = path.join(workspace, 'extracted')
    await mkdir(out, { recursive: true })
    await TAR(['-xzf', archive, '-C', out])

    for (const [name, expected] of Object.entries(files)) {
      const actual = await readFile(path.join(out, name), 'utf8')
      expect(actual, `${name} must round-trip unchanged`).toBe(expected)
    }
  })

  it.skipIf(!hasTar)('passes tar\'s own checksum validation', async () => {
    const { stderr } = await TAR(['-tzf', archive])
    expect(stderr.trim()).toBe('')
  })
})
