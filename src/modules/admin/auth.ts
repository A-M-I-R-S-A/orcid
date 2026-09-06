import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { adminUsers, roles } from '@/db/schema'
import * as audit from '@/lib/audit'
import { verifyPassword } from '@/lib/crypto'
import { errors } from '@/lib/errors'
import { type Permission, hasPermission } from '@/lib/permissions'
import { enforce } from '@/lib/rate-limit'
import { createAdminSession, getCurrentAdmin } from '@/lib/session'
import type { AdminPrincipal } from '@/lib/permissions'

const MAX_FAILED = 8
const LOCKOUT_MS = 15 * 60 * 1000

const GENERIC_LOGIN_ERROR = 'نام کاربری یا رمز عبور اشتباه است.'

export async function login(
  username: string,
  password: string,
  meta: { ip: string; userAgent?: string },
): Promise<AdminPrincipal> {
  await enforce(`ip:${meta.ip}`, 'admin_login', GENERIC_LOGIN_ERROR)

  const [account] = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      fullName: adminUsers.fullName,
      passwordHash: adminUsers.passwordHash,
      isActive: adminUsers.isActive,
      failedAttempts: adminUsers.failedAttempts,
      lockedUntil: adminUsers.lockedUntil,
      roleKey: roles.key,
    })
    .from(adminUsers)
    .innerJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(eq(adminUsers.username, username))
    .limit(1)

  if (!account) {
    await verifyPassword(password, 'scrypt:16384:8:1:00:00')
    throw errors.validation(GENERIC_LOGIN_ERROR)
  }

  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    throw errors.rateLimited('حساب کاربری موقتاً قفل شده است. لطفاً بعداً تلاش کنید.')
  }

  const valid = await verifyPassword(password, account.passwordHash)

  if (!valid) {
    const attempts = account.failedAttempts + 1
    await db
      .update(adminUsers)
      .set({
        failedAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MS) : null,
      })
      .where(eq(adminUsers.id, account.id))

    await audit.log({
      actor: null,
      action: 'admin.login_failed',
      entityType: 'admin_user',
      entityId: account.id,
      summary: `تلاش ناموفق برای ورود: ${username}`,
      ip: meta.ip,
    })

    throw errors.validation(GENERIC_LOGIN_ERROR)
  }

  if (!account.isActive) {
    throw errors.forbidden('این حساب کاربری غیرفعال است.')
  }

  await db
    .update(adminUsers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(adminUsers.id, account.id))

  await createAdminSession(account.id, { ip: meta.ip, userAgent: meta.userAgent })

  const principal: AdminPrincipal = {
    id: account.id,
    username: account.username,
    fullName: account.fullName,
    roleKey: account.roleKey,
    permissions: new Set(),
  }

  await audit.log({
    actor: principal,
    action: 'admin.login',
    entityType: 'admin_user',
    entityId: account.id,
    ip: meta.ip,
  })

  return principal
}

export async function requireAdmin(): Promise<AdminPrincipal> {
  const admin = await getCurrentAdmin()
  if (!admin) throw errors.unauthenticated()
  return admin
}

export async function requirePermission(permission: Permission): Promise<AdminPrincipal> {
  const admin = await requireAdmin()
  if (!hasPermission(admin, permission)) {
    throw errors.forbidden()
  }
  return admin
}

export async function can(permission: Permission): Promise<boolean> {
  const admin = await getCurrentAdmin()
  return admin ? hasPermission(admin, permission) : false
}

export async function listAdmins() {
  return db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      fullName: adminUsers.fullName,
      email: adminUsers.email,
      isActive: adminUsers.isActive,
      lastLoginAt: adminUsers.lastLoginAt,
      lockedUntil: adminUsers.lockedUntil,
      roleId: roles.id,
      roleName: roles.name,
      roleKey: roles.key,
    })
    .from(adminUsers)
    .innerJoin(roles, eq(adminUsers.roleId, roles.id))
    .orderBy(adminUsers.username)
}

export async function listRoles() {
  return db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      memberCount: sql<number>`(SELECT COUNT(*) FROM admin_users WHERE role_id = ${roles.id})`,
    })
    .from(roles)
    .orderBy(roles.id)
}

export async function isLastActiveSuperadmin(adminId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(adminUsers)
    .innerJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(sql`${roles.key} = 'superadmin' AND ${adminUsers.isActive} = 1 AND ${adminUsers.id} <> ${adminId}`)

  return Number(row?.count ?? 0) === 0
}
