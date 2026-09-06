import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { permissions, rolePermissions } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { AdminUserManager, RolePermissionManager } from '@/components/admin/admin-users'
import { listAdmins, listRoles, requirePermission } from '@/modules/admin/auth'
import { PERMISSION_GROUPS, groupedPermissions } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مدیران' }

export default async function AdminUsersPage() {
  await requirePermission('admins.view')

  const [admins, roles, grantedRows] = await Promise.all([
    listAdmins(),
    listRoles(),
    db
      .select({ roleId: rolePermissions.roleId, key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)),
  ])

  const grantedByRole = new Map<number, string[]>()
  for (const row of grantedRows) {
    const list = grantedByRole.get(row.roleId) ?? []
    list.push(row.key)
    grantedByRole.set(row.roleId, list)
  }

  const groups = [...groupedPermissions().entries()].map(([group, items]) => ({
    key: group,
    label: PERMISSION_GROUPS[group],
    items,
  }))

  return (
    <>
      <PageHeader
        title="مدیران و دسترسی‌ها"
        description="حساب‌های مدیریتی، نقش‌ها و سطوح دسترسی"
      />

      <div className="space-y-8">
        <AdminUserManager
          admins={admins.map((a) => ({
            id: a.id,
            username: a.username,
            fullName: a.fullName,
            email: a.email,
            isActive: a.isActive,
            roleId: a.roleId,
            roleName: a.roleName,
            roleKey: a.roleKey,
            lastLoginAt: a.lastLoginAt,
            lockedUntil: a.lockedUntil,
          }))}
          roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))}
        />

        <RolePermissionManager
          roles={roles.map((r) => ({
            id: r.id,
            key: r.key,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            memberCount: Number(r.memberCount),
            granted: grantedByRole.get(r.id) ?? [],
          }))}
          groups={groups}
        />
      </div>
    </>
  )
}
