import { NextResponse } from 'next/server'

import { db } from '@/db'
import { wishlistItems } from '@/db/schema'
import { getCurrentUser } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ids: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, user.id))
    .limit(500)

  return NextResponse.json(
    { ids: rows.map((r) => r.productId) },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
