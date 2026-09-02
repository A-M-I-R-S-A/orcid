import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'

import { contentTypeFor, resolveStoredPath } from '@/lib/images'

/**
 * Media route handler. §16 / §76.
 *
 * Uploads live OUTSIDE the deploy directory so a release cannot delete them
 * (planning §N-2), which means they are not in `public/` and something has to
 * serve them. This is that something.
 *
 * It is also the security boundary for path traversal. Three independent
 * checks apply, in order:
 *
 *   1. Reject any segment containing "..", a backslash, or a NUL byte.
 *   2. `resolveStoredPath` resolves the absolute path and throws unless it is
 *      still inside the upload root — this catches encoding tricks the first
 *      check misses.
 *   3. The extension must map to a known image content type; anything else
 *      404s rather than being served as an unknown type.
 *
 * The response always carries an explicit Content-Type and nosniff, so a file
 * can never be interpreted as script no matter what it is named.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params

  if (!segments || segments.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  // Check 1 — obvious traversal and injection attempts.
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

  // Check 3 — before touching the filesystem.
  const contentType = contentTypeFor(relative)
  if (!contentType) {
    return new Response('Not found', { status: 404 })
  }

  let absolute: string
  try {
    // Check 2 — the real boundary.
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
        // Filenames are random and content is never rewritten in place, so
        // these are safe to cache forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ETag: `"${stats.size}-${stats.mtimeMs}"`,
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
