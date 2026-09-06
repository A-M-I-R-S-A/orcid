'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { adminUsers, permissions, rolePermissions, roles } from '@/db/schema'
import * as audit from '@/lib/audit'
import { hashPassword } from '@/lib/crypto'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { type Permission, ALL_PERMISSIONS } from '@/lib/permissions'
import { toPersianDigits } from '@/lib/persian'
import { clientIp } from '@/lib/rate-limit'
import { revokeAllAdminSessions } from '@/lib/session'
import { isLastActiveSuperadmin, requirePermission } from './auth'

const MIN_PASSWORD_LENGTH = 10

export async function saveAdminUserAction(input: {
  id?: number
  username: string
  fullName: string
  email?: string
  password?: string
  roleId: number
  isActive: boolean
}): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requirePermission('admins.manage')
    const headerList = await headers()

    if (!input.username.trim()) throw errors.validation('نام کاربری الزامی است.')
    if (!input.fullName.trim()) throw errors.validation('نام و نام خانوادگی الزامی است.')

    const [role] = await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1)
    if (!role) throw errors.validation('نقش انتخاب‌شده معتبر نیست.')

    if (input.id) {
      const [existing] = await db
        .select({ id: adminUsers.id, roleId: adminUsers.roleId, isActive: adminUsers.isActive })
        .from(adminUsers)
        .where(eq(adminUsers.id, input.id))
        .limit(1)

      if (!existing) throw errors.notFound()

      const [currentRole] = await db
        .select({ key: roles.key })
        .from(roles)
        .where(eq(roles.id, existing.roleId))
        .limit(1)

      const losingSuperadmin =
        currentRole?.key === 'superadmin' && (role.key !== 'superadmin' || !input.isActive)

      if (losingSuperadmin && (await isLastActiveSuperadmin(input.id))) {
        throw errors.conflict(
          'این تنها مدیر کل فعال است. پیش از تغییر نقش یا غیرفعال‌سازی، مدیر کل دیگری تعریف کنید.',
        )
      }

      const updates: Record<string, unknown> = {
        username: input.username.trim(),
        fullName: input.fullName.trim(),
        email: input.email?.trim() || null,
        roleId: input.roleId,
        isActive: input.isActive,
      }

      if (input.password) {
        if (input.password.length < MIN_PASSWORD_LENGTH) {
          throw errors.validation(`رمز عبور باید حداقل ${toPersianDigits(MIN_PASSWORD_LENGTH)} کاراکتر باشد.`)
        }
        updates.passwordHash = await hashPassword(input.password)
        updates.failedAttempts = 0
        updates.lockedUntil = null
      }

      await db.update(adminUsers).set(updates).where(eq(adminUsers.id, input.id))

      if (input.password || !input.isActive) {
        await revokeAllAdminSessions(input.id)
      }

      await audit.log({
        actor,
        action: input.isActive ? 'admin.update' : 'admin.disable',
        entityType: 'admin_user',
        entityId: input.id,
        summary: input.username,
        metadata: { role: role.key, passwordChanged: Boolean(input.password) },
        ip: clientIp(headerList),
      })

      revalidatePath('/admin/admins')
      return ok({ id: input.id })
    }

    if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
      throw errors.validation(`رمز عبور باید حداقل ${toPersianDigits(MIN_PASSWORD_LENGTH)} کاراکتر باشد.`)
    }

    const [inserted] = await db.insert(adminUsers).values({
      username: input.username.trim(),
      fullName: input.fullName.trim(),
      email: input.email?.trim() || null,
      passwordHash: await hashPassword(input.password),
      roleId: input.roleId,
      isActive: input.isActive,
    })

    const id = (inserted as unknown as { insertId: number }).insertId

    await audit.log({
      actor,
      action: 'admin.create',
      entityType: 'admin_user',
      entityId: id,
      summary: input.username,
      metadata: { role: role.key },
      ip: clientIp(headerList),
    })

    revalidatePath('/admin/admins')
    return ok({ id })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return fail(errors.conflict('این نام کاربری قبلاً استفاده شده است.'))
    }
    return fail(error, { action: 'saveAdminUser' })
  }
}

export async function saveRolePermissionsAction(input: {
  roleId: number
  permissions: string[]
}): Promise<ActionResult<void>> {
  try {
    const actor = await requirePermission('admins.manage')
    const headerList = await headers()

    const [role] = await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1)
    if (!role) throw errors.notFound()

    if (role.key === 'superadmin') {
      throw errors.conflict('نقش مدیر کل همیشه دسترسی کامل دارد و قابل تغییر نیست.')
    }

    const valid = input.permissions.filter((p) =>
      ALL_PERMISSIONS.includes(p as Permission),
    )

    const rows =
      valid.length > 0
        ? await db
            .select({ id: permissions.id, key: permissions.key })
            .from(permissions)
            .where(inArray(permissions.key, valid))
        : []

    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId))

      if (rows.length > 0) {
        await tx.insert(rolePermissions).values(
          rows.map((row) => ({ roleId: input.roleId, permissionId: row.id })),
        )
      }
    })

    await audit.log({
      actor,
      action: 'admin.permissions_change',
      entityType: 'role',
      entityId: input.roleId,
      summary: role.name,
      metadata: { permissions: valid },
      ip: clientIp(headerList),
    })

    revalidatePath('/admin/admins')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveRolePermissions', roleId: input.roleId })
  }
}
