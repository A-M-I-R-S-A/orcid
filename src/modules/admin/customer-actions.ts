'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { users } from '@/db/schema'
import * as audit from '@/lib/audit'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { revokeAllUserSessions } from '@/lib/session'
import { requirePermission } from './auth'

export async function setCustomerStatusAction(input: {
  userId: number
  isActive: boolean
  reason?: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('customers.manage')
    const headerList = await headers()

    const [user] = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)

    if (!user) throw errors.notFound()

    await db
      .update(users)
      .set({
        isActive: input.isActive,
        disabledReason: input.isActive ? null : (input.reason ?? null),
      })
      .where(eq(users.id, input.userId))

    if (!input.isActive) {
      await revokeAllUserSessions(input.userId)
    }

    await audit.log({
      actor: admin,
      action: input.isActive ? 'customer.enable' : 'customer.disable',
      entityType: 'user',
      entityId: input.userId,
      summary: user.phone,
      metadata: input.reason ? { reason: input.reason } : undefined,
      ip: clientIp(headerList),
    })

    revalidatePath('/admin/customers')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'setCustomerStatus', userId: input.userId })
  }
}
