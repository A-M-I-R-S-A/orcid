import 'server-only'

import { cookies } from 'next/headers'
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/db'
import { adminSessions, adminUsers, permissions, rolePermissions, roles, sessions, users } from '@/db/schema'
import { generateToken, hashToken } from './crypto'
import type { AdminPrincipal, Permission } from './permissions'

const CUSTOMER_COOKIE = '__Host-orchid_session'
const ADMIN_COOKIE = '__Host-orchid_admin'

const CUSTOMER_TTL_DAYS = 30
const ADMIN_TTL_HOURS = 12

const BASE_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const

export interface CustomerPrincipal {
  id: number
  phone: string
  fullName: string | null
  isActive: boolean
}

export async function createSession(
  userId: number,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + CUSTOMER_TTL_DAYS * 86_400_000)

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    ip: meta.ip?.slice(0, 45),
    userAgent: meta.userAgent?.slice(0, 255),
    expiresAt,
  })

  const store = await cookies()
  store.set(CUSTOMER_COOKIE, token, { ...BASE_COOKIE, expires: expiresAt })

  return token
}

export async function getCurrentUser(): Promise<CustomerPrincipal | null> {
  const store = await cookies()
  const token = store.get(CUSTOMER_COOKIE)?.value
  if (!token) return null

  const [row] = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1)

  if (!row || !row.isActive) return null
  return row
}

export async function requireUser(): Promise<CustomerPrincipal> {
  const user = await getCurrentUser()
  if (!user) {
    const { errors } = await import('./errors')
    throw errors.unauthenticated()
  }
  return user
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(CUSTOMER_COOKIE)?.value

  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)))
  }

  store.delete(CUSTOMER_COOKIE)
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId))
}

export async function createAdminSession(
  adminUserId: number,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + ADMIN_TTL_HOURS * 3_600_000)

  await db.insert(adminSessions).values({
    adminUserId,
    tokenHash: hashToken(token),
    ip: meta.ip?.slice(0, 45),
    userAgent: meta.userAgent?.slice(0, 255),
    expiresAt,
  })

  const store = await cookies()
  store.set(ADMIN_COOKIE, token, { ...BASE_COOKIE, expires: expiresAt })

  return token
}

export async function getCurrentAdmin(): Promise<AdminPrincipal | null> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (!token) return null

  const [row] = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      fullName: adminUsers.fullName,
      isActive: adminUsers.isActive,
      roleId: adminUsers.roleId,
      roleKey: roles.key,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .innerJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        gt(adminSessions.expiresAt, new Date()),
        isNull(adminSessions.revokedAt),
      ),
    )
    .limit(1)

  if (!row || !row.isActive) return null

  if (row.roleKey === 'superadmin') {
    return {
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      roleKey: row.roleKey,
      permissions: new Set<Permission>(),
    }
  }

  const granted = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, row.roleId))

  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    roleKey: row.roleKey,
    permissions: new Set(granted.map((g) => g.key as Permission)),
  }
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value

  if (token) {
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessions.tokenHash, hashToken(token)))
  }

  store.delete(ADMIN_COOKIE)
}

export async function revokeAllAdminSessions(adminUserId: number): Promise<void> {
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.adminUserId, adminUserId))
}

export async function pruneSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000)

  await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, new Date()), lt(sessions.revokedAt, cutoff)))

  await db
    .delete(adminSessions)
    .where(or(lt(adminSessions.expiresAt, new Date()), lt(adminSessions.revokedAt, cutoff)))
}

export { CUSTOMER_COOKIE, ADMIN_COOKIE }
