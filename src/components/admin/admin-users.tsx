'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { saveAdminUserAction, saveRolePermissionsAction } from '@/modules/admin/user-actions'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

interface AdminUser {
  id: number
  username: string
  fullName: string
  email: string | null
  isActive: boolean
  roleId: number
  roleName: string
  roleKey: string
  lastLoginAt: Date | null
  lockedUntil: Date | null
}

export function AdminUserManager({
  admins,
  roles,
}: {
  admins: AdminUser[]
  roles: { id: number; name: string; key: string }[]
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-ink">حساب‌های مدیریتی</h2>
        <button
          type="button"
          onClick={() => setEditing(editing === 'new' ? null : 'new')}
          className="btn btn-primary btn-sm"
        >
          {editing === 'new' ? 'انصراف' : 'مدیر جدید'}
        </button>
      </div>

      {editing === 'new' && (
        <div className="mb-4">
          <AdminUserForm admin={null} roles={roles} onDone={() => setEditing(null)} />
        </div>
      )}

      <div className="space-y-3">
        {admins.map((admin) => {
          const locked = admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()

          return (
            <div key={admin.id}>
              <div className="card p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[150px]">
                  <p className="font-medium text-ink">{admin.fullName}</p>
                  <p className="text-xs text-ink-subtle" dir="ltr">
                    {admin.username}
                  </p>
                </div>

                <span className="badge badge-neutral">{admin.roleName}</span>

                {locked && <span className="badge badge-pending">قفل موقت</span>}

                <span className={`badge ${admin.isActive ? 'badge-positive' : 'badge-negative'}`}>
                  {admin.isActive ? 'فعال' : 'غیرفعال'}
                </span>

                <span className="text-xs text-ink-muted nums">
                  {admin.lastLoginAt ? formatJalaliDateTime(admin.lastLoginAt) : 'بدون ورود'}
                </span>

                <button
                  type="button"
                  onClick={() => setEditing(editing === admin.id ? null : admin.id)}
                  className="btn btn-ghost btn-sm"
                >
                  {editing === admin.id ? 'بستن' : 'ویرایش'}
                </button>
              </div>

              {editing === admin.id && (
                <div className="mt-3">
                  <AdminUserForm admin={admin} roles={roles} onDone={() => setEditing(null)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AdminUserForm({
  admin,
  roles,
  onDone,
}: {
  admin: AdminUser | null
  roles: { id: number; name: string; key: string }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="card p-5 border-accent-3">
      <form
        className="space-y-5"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await saveAdminUserAction({
              id: admin?.id,
              username: String(formData.get('username') ?? ''),
              fullName: String(formData.get('fullName') ?? ''),
              email: String(formData.get('email') ?? ''),
              password: String(formData.get('password') ?? '') || undefined,
              roleId: Number(formData.get('roleId')),
              isActive: formData.get('isActive') === 'on',
            })

            if (result.ok) {
              onDone()
              router.refresh()
            } else {
              setError(result.error)
            }
          })
        }}
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="label">نام و نام خانوادگی</label>
            <input name="fullName" required defaultValue={admin?.fullName ?? ''} className="field" />
          </div>

          <div>
            <label className="label">نام کاربری</label>
            <input
              name="username"
              required
              dir="ltr"
              autoCapitalize="off"
              spellCheck={false}
              defaultValue={admin?.username ?? ''}
              className="field"
            />
          </div>

          <div>
            <label className="label">ایمیل (اختیاری)</label>
            <input
              name="email"
              type="email"
              dir="ltr"
              defaultValue={admin?.email ?? ''}
              className="field"
            />
          </div>

          <div>
            <label className="label">نقش</label>
            <select name="roleId" defaultValue={admin?.roleId ?? ''} required className="field">
              <option value="">انتخاب کنید</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">
              {admin ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'}
            </label>
            <input
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              minLength={10}
              required={!admin}
              className="field"
              placeholder={admin ? 'برای حفظ رمز فعلی خالی بگذارید' : 'حداقل ۱۰ کاراکتر'}
            />
            {admin && (
              <p className="hint">
                با تغییر رمز عبور، تمام نشست‌های فعال این مدیر بسته می‌شود.
              </p>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={admin?.isActive ?? true}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          حساب فعال
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
            انصراف
          </button>
        </div>
      </form>
    </div>
  )
}

interface Role {
  id: number
  key: string
  name: string
  description: string | null
  isSystem: boolean
  memberCount: number
  granted: string[]
}

export function RolePermissionManager({
  roles,
  groups,
}: {
  roles: Role[]
  groups: { key: string; label: string; items: { key: string; label: string }[] }[]
}) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section>
      <h2 className="text-lg text-ink mb-4">نقش‌ها و دسترسی‌ها</h2>

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id}>
            <div className="card p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[150px]">
                <p className="font-medium text-ink">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-ink-subtle mt-0.5">{role.description}</p>
                )}
              </div>

              <span className="text-xs text-ink-muted nums">
                {toPersianDigits(role.memberCount)} مدیر
              </span>

              {role.key === 'superadmin' ? (
                <span className="badge badge-accent">دسترسی کامل</span>
              ) : (
                <span className="text-xs text-ink-muted nums">
                  {toPersianDigits(role.granted.length)} دسترسی
                </span>
              )}

              {role.key !== 'superadmin' && (
                <button
                  type="button"
                  onClick={() => setOpen(open === role.id ? null : role.id)}
                  className="btn btn-ghost btn-sm"
                >
                  {open === role.id ? 'بستن' : 'ویرایش دسترسی‌ها'}
                </button>
              )}
            </div>

            {open === role.id && (
              <div className="mt-3">
                <RolePermissionForm role={role} groups={groups} onDone={() => setOpen(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function RolePermissionForm({
  role,
  groups,
  onDone,
}: {
  role: Role
  groups: { key: string; label: string; items: { key: string; label: string }[] }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set(role.granted))
  const [error, setError] = useState<string | null>(null)

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (items: { key: string }[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      for (const item of items) {
        if (on) next.add(item.key)
        else next.delete(item.key)
      }
      return next
    })

  return (
    <div className="card p-5 border-accent-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map((group) => {
          const allOn = group.items.every((item) => selected.has(item.key))

          return (
            <fieldset key={group.key}>
              <legend className="flex items-center justify-between w-full mb-2">
                <span className="text-sm font-medium text-ink">{group.label}</span>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.items, !allOn)}
                  className="text-xs text-accent-2 hover:underline"
                >
                  {allOn ? 'هیچ‌کدام' : 'همه'}
                </button>
              </legend>

              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(item.key)}
                      onChange={() => toggle(item.key)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-ink-muted">{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}
      </div>

      {error && <p className="text-sm text-danger mt-4">{error}</p>}

      <div className="flex gap-2 mt-5 pt-5 border-t border-line">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await saveRolePermissionsAction({
                roleId: role.id,
                permissions: [...selected],
              })
              if (result.ok) {
                onDone()
                router.refresh()
              } else {
                setError(result.error)
              }
            })
          }
          className="btn btn-primary btn-sm"
        >
          {pending ? 'در حال ذخیره…' : 'ذخیره دسترسی‌ها'}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
          انصراف
        </button>
      </div>
    </div>
  )
}
