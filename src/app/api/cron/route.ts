import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

import { pruneAbandoned } from '@/modules/cart/service'
import { pruneExpiredOtps, pruneUnverifiedAccounts } from '@/modules/auth/service'
import { dispatchPending } from '@/modules/sms/service'
import { pruneExpired as pruneRateLimits } from '@/lib/rate-limit'
import { pruneSessions } from '@/lib/session'
import { logger } from '@/lib/logger'
import { backupAgeHours, dumpDatabase } from '@/lib/backup'
import { archiveMedia, mediaArchiveAgeHours } from '@/lib/media-backup'

export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''

  const a = Buffer.from(presented)
  const b = Buffer.from(secret)

  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return new Response('Not found', { status: 404 })
  }

  const started = Date.now()
  const results: Record<string, unknown> = {}
  const failed: string[] = []

  async function run(name: string, task: () => Promise<unknown>): Promise<void> {
    try {
      results[name] = (await task()) ?? 'ok'
    } catch (error) {
      failed.push(name)
      results[name] = { error: error instanceof Error ? error.message : String(error) }

      logger.error('cron task failed', {
        task: name,
        detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
      })
    }
  }

  await run('sms', () => dispatchPending(30))
  await run('sessions', async () => {
    await pruneSessions()
    return 'pruned'
  })
  await run('otps', async () => {
    await pruneExpiredOtps()
    return { pruned: true, unverifiedAccounts: await pruneUnverifiedAccounts() }
  })
  await run('rateLimits', () => pruneRateLimits())
  await run('carts', async () => {
    await pruneAbandoned()
    return 'pruned'
  })

  const force = new URL(request.url).searchParams.get('backup') === 'force'
  const age = await backupAgeHours()

  if (force || age === null || age >= 20) {
    await run('backup', async () => {
      const { file, bytes, rows, tables } = await dumpDatabase()
      return { file: file.split(/[\\/]/).pop(), bytes, rows, tables }
    })
  } else {
    results.backup = { skipped: `last dump ${age.toFixed(1)}h ago` }
  }

  const mediaAge = await mediaArchiveAgeHours()

  if (force || mediaAge === null || mediaAge >= 24 * 6) {
    await run('mediaArchive', async () => {
      const { file, bytes, files } = await archiveMedia()
      return { file: file.split(/[\\/]/).pop(), bytes, files }
    })
  } else {
    results.mediaArchive = { skipped: `last archive ${(mediaAge / 24).toFixed(1)}d ago` }
  }

  const ok = failed.length === 0
  const durationMs = Date.now() - started

  logger.info('cron run complete', { ok, durationMs, failed })

  return Response.json(
    { ok, durationMs, failed, results },
    { status: ok ? 200 : 500 },
  )
}
