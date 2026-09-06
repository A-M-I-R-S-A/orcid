import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'

import { contentTypeFor, resolveStoredPath } from '@/lib/images'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params

  if (!segments || segments.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  for (const segment of segments) {
    if (
      segment.includes('..') ||
      segment.includes('\\') ||
      segment.includes('\0') ||
      segment.startsWith('.')
    ) {
      return new Response('Not found', { status: 404 })
    }
  }

  const relative = segments.join('/')

  const contentType = contentTypeFor(relative)
  if (!contentType) {
    return new Response('Not found', { status: 404 })
  }

  let absolute: string
  try {
    absolute = resolveStoredPath(relative)
  } catch {
    return new Response('Not found', { status: 404 })
  }

  try {
    const stats = await stat(absolute)
    if (!stats.isFile()) {
      return new Response('Not found', { status: 404 })
    }

    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream

    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ETag: `"${stats.size}-${stats.mtimeMs}"`,
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
