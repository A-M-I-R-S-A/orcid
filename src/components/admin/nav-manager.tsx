'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  clearLogoAction,
  createNavLinkAction,
  deleteNavLinkAction,
  moveNavLinkAction,
  seedNavFromCategoriesAction,
  updateNavLinkAction,
  uploadLogoAction,
} from '@/modules/admin/nav-actions'
import { mediaUrl } from '@/lib/media-url'

export interface NavLinkRow {
  id: number
  label: string
  href: string
  isVisible: boolean
  sortOrder: number
}

type Message = { tone: 'ok' | 'error'; text: string } | null

function Notice({ message }: { message: Message }) {
  if (!message) return null
  return (
    <p className={`text-sm ${message.tone === 'ok' ? 'text-ink-muted' : 'text-danger'}`}>
      {message.text}
    </p>
  )
}

export function NavPlacementEditor({
  placement,
  title,
  description,
  links,
  fallbackNote,
}: {
  placement: string
  title: string
  description: string
  links: NavLinkRow[]
  fallbackNote?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<Message>(null)
  const [adding, setAdding] = useState(false)

  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setMessage(null)
    startTransition(async () => {
      const result = await task()
      setMessage(
        result.ok
          ? { tone: 'ok', text: success }
          : { tone: 'error', text: result.error ?? 'خطا در ذخیره‌سازی.' },
      )
      if (result.ok) router.refresh()
    })
  }

  return (
    <section className="card overflow-hidden">
      <div className="p-5 border-b border-line">
        <h2 className="font-medium text-ink">{title}</h2>
        <p className="text-xs text-ink-subtle mt-1">{description}</p>
      </div>

      {links.length === 0 ? (
        <div className="p-5 text-sm text-ink-muted space-y-3">
          <p>{fallbackNote ?? 'هنوز پیوندی تعریف نشده است.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {links.map((link, index) => (
            <NavLinkRowEditor
              key={link.id}
              link={link}
              isFirst={index === 0}
              isLast={index === links.length - 1}
              pending={pending}
              onRun={run}
            />
          ))}
        </ul>
      )}

      <div className="p-5 border-t border-line bg-surface-sunken/30 space-y-4">
        {adding ? (
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            action={(formData) => {
              run(
                () =>
                  createNavLinkAction({
                    placement,
                    label: String(formData.get('label') ?? ''),
                    href: String(formData.get('href') ?? ''),
                  }),
                'پیوند افزوده شد.',
              )
              setAdding(false)
            }}
          >
            <label className="block">
              <span className="block text-xs text-ink-muted mb-1">عنوان</span>
              <input name="label" required maxLength={60} className="input w-full" />
            </label>
            <label className="block">
              <span className="block text-xs text-ink-muted mb-1">پیوند</span>
              <input
                name="href"
                required
                maxLength={255}
                dir="ltr"
                placeholder="/category/bra"
                className="input w-full"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
                افزودن
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="btn btn-ghost btn-sm"
              >
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              افزودن پیوند
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => seedNavFromCategoriesAction(placement),
                  'دسته‌بندی‌های اصلی افزوده شدند.',
                )
              }
              className="btn btn-ghost btn-sm"
            >
              افزودن دسته‌بندی‌های اصلی
            </button>
          </div>
        )}

        <Notice message={message} />
      </div>
    </section>
  )
}

function NavLinkRowEditor({
  link,
  isFirst,
  isLast,
  pending,
  onRun,
}: {
  link: NavLinkRow
  isFirst: boolean
  isLast: boolean
  pending: boolean
  onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-label="انتقال به بالا"
            disabled={pending || isFirst}
            onClick={() => onRun(() => moveNavLinkAction(link.id, 'up'), 'ترتیب به‌روز شد.')}
            className="btn btn-ghost btn-sm px-1.5 py-0.5 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="انتقال به پایین"
            disabled={pending || isLast}
            onClick={() => onRun(() => moveNavLinkAction(link.id, 'down'), 'ترتیب به‌روز شد.')}
            className="btn btn-ghost btn-sm px-1.5 py-0.5 disabled:opacity-30"
          >
            ↓
          </button>
        </div>

        <div className="flex-1 min-w-[160px]">
          <p className="font-medium text-ink">{link.label}</p>
          <p className="text-xs text-ink-subtle mt-0.5" dir="ltr">
            {link.href}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={link.isVisible}
            disabled={pending}
            onChange={(event) =>
              onRun(
                () =>
                  updateNavLinkAction({
                    id: link.id,
                    label: link.label,
                    href: link.href,
                    isVisible: event.target.checked,
                  }),
                'ذخیره شد.',
              )
            }
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          نمایش
        </label>

        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm">
          {open ? 'بستن' : 'ویرایش'}
        </button>
      </div>

      {open && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          action={(formData) => {
            onRun(
              () =>
                updateNavLinkAction({
                  id: link.id,
                  label: String(formData.get('label') ?? ''),
                  href: String(formData.get('href') ?? ''),
                  isVisible: link.isVisible,
                }),
              'ذخیره شد.',
            )
            setOpen(false)
          }}
        >
          <label className="block">
            <span className="block text-xs text-ink-muted mb-1">عنوان</span>
            <input
              name="label"
              defaultValue={link.label}
              required
              maxLength={60}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-muted mb-1">پیوند</span>
            <input
              name="href"
              defaultValue={link.href}
              required
              maxLength={255}
              dir="ltr"
              className="input w-full"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
              ذخیره
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`«${link.label}» حذف شود؟`)) return
                onRun(() => deleteNavLinkAction(link.id), 'حذف شد.')
              }}
              className="btn btn-ghost btn-sm text-danger"
            >
              حذف
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

export function LogoManager({ logoPath }: { logoPath: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<Message>(null)

  return (
    <section className="card overflow-hidden">
      <div className="p-5 border-b border-line">
        <h2 className="font-medium text-ink">لوگو</h2>
        <p className="text-xs text-ink-subtle mt-1">
          در هدر، فوتر و داده‌های ساختاریافته استفاده می‌شود. PNG یا SVG با پس‌زمینه شفاف.
        </p>
      </div>

      <div className="p-5 flex flex-wrap items-center gap-5">
        <div className="h-14 w-40 rounded-lg bg-surface-sunken flex items-center justify-center overflow-hidden">
          <img
            src={logoPath ? mediaUrl(logoPath) : '/logo.png'}
            alt="لوگوی فعلی"
            className="max-h-11 w-auto object-contain"
          />
        </div>

        <form
          className="flex flex-wrap items-center gap-2"
          action={(formData) => {
            setMessage(null)
            startTransition(async () => {
              const result = await uploadLogoAction(formData)
              setMessage(
                result.ok
                  ? { tone: 'ok', text: 'لوگو به‌روز شد.' }
                  : { tone: 'error', text: result.error },
              )
              if (result.ok) router.refresh()
            })
          }}
        >
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            required
            className="text-sm"
          />
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            بارگذاری
          </button>
        </form>

        {logoPath && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null)
              startTransition(async () => {
                const result = await clearLogoAction()
                setMessage(
                  result.ok
                    ? { tone: 'ok', text: 'به لوگوی پیش‌فرض بازگشت.' }
                    : { tone: 'error', text: result.error },
                )
                if (result.ok) router.refresh()
              })
            }}
            className="btn btn-ghost btn-sm"
          >
            بازگشت به پیش‌فرض
          </button>
        )}
      </div>

      <div className="px-5 pb-5">
        <Notice message={message} />
      </div>
    </section>
  )
}
