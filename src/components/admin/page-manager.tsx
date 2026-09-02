'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deletePageAction, savePageAction } from '@/modules/admin/content-actions'

interface CmsPage {
  id: number
  slug: string
  title: string
  body: string
  isPublished: boolean
  showInFooter: boolean
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
}

export function PageManager({ pages }: { pages: CmsPage[] }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditing(editing === 'new' ? null : 'new')}
        className="btn btn-primary btn-sm"
      >
        {editing === 'new' ? 'انصراف' : 'صفحه جدید'}
      </button>

      {editing === 'new' && <PageForm page={null} onDone={() => setEditing(null)} />}

      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.id}>
            <div className="card p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[160px]">
                <p className="font-medium text-ink">{page.title}</p>
                <p className="text-xs text-ink-subtle truncate">/p/{page.slug}</p>
              </div>

              {page.showInFooter && <span className="badge badge-neutral">در فوتر</span>}

              <span className={`badge ${page.isPublished ? 'badge-positive' : 'badge-pending'}`}>
                {page.isPublished ? 'منتشر شده' : 'پیش‌نویس'}
              </span>

              <Link
                href={`/p/${encodeURIComponent(page.slug)}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-accent-2 hover:underline"
              >
                مشاهده ↗
              </Link>

              <button
                type="button"
                onClick={() => setEditing(editing === page.id ? null : page.id)}
                className="btn btn-ghost btn-sm"
              >
                {editing === page.id ? 'بستن' : 'ویرایش'}
              </button>
            </div>

            {editing === page.id && (
              <div className="mt-3">
                <PageForm page={page} onDone={() => setEditing(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PageForm({ page, onDone }: { page: CmsPage | null; onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="card p-5 border-accent-3">
      <form
        className="space-y-5"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await savePageAction({
              id: page?.id,
              slug: String(formData.get('slug') ?? ''),
              title: String(formData.get('title') ?? ''),
              body: String(formData.get('body') ?? ''),
              isPublished: formData.get('isPublished') === 'on',
              showInFooter: formData.get('showInFooter') === 'on',
              sortOrder: Number(formData.get('sortOrder') ?? 0),
              seoTitle: String(formData.get('seoTitle') ?? ''),
              seoDescription: String(formData.get('seoDescription') ?? ''),
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
            <label className="label">عنوان صفحه</label>
            <input name="title" required defaultValue={page?.title ?? ''} className="field" />
          </div>

          <div>
            <label className="label">نشانی (slug)</label>
            <input
              name="slug"
              defaultValue={page?.slug ?? ''}
              className="field"
              placeholder="خالی بگذارید تا از عنوان ساخته شود"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">محتوا</label>
            <textarea
              name="body"
              rows={12}
              defaultValue={page?.body ?? ''}
              className="field resize-y font-mono text-sm"
              dir="auto"
            />
            {/*
              HTML is allowed but sanitised on save AND on render. The allowlist
              is narrow — no <script>, no <style>, no inline event handlers.
            */}
            <p className="hint">
              می‌توانید از تگ‌های ساده HTML استفاده کنید: پاراگراف، عنوان، فهرست، لینک و تصویر.
              تگ‌های ناامن به‌صورت خودکار حذف می‌شوند.
            </p>
          </div>

          <div>
            <label className="label">عنوان سئو</label>
            <input name="seoTitle" defaultValue={page?.seoTitle ?? ''} className="field" />
          </div>

          <div>
            <label className="label">توضیحات سئو</label>
            <input
              name="seoDescription"
              defaultValue={page?.seoDescription ?? ''}
              className="field"
            />
          </div>

          <div>
            <label className="label">ترتیب در فوتر</label>
            <input
              name="sortOrder"
              type="number"
              defaultValue={page?.sortOrder ?? 0}
              dir="ltr"
              className="field nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={page?.isPublished ?? true}
              className="accent-[var(--color-accent)] w-4 h-4"
            />
            منتشر شده
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="showInFooter"
              defaultChecked={page?.showInFooter ?? false}
              className="accent-[var(--color-accent)] w-4 h-4"
            />
            نمایش در فوتر
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
            انصراف
          </button>
        </div>
      </form>

      {page && (
        <div className="mt-5 pt-5 border-t border-line">
          {confirmDelete ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-danger">این صفحه حذف شود؟</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deletePageAction(page.id)
                    onDone()
                    router.refresh()
                  })
                }
                className="btn btn-sm bg-danger text-white"
              >
                بله، حذف کن
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn btn-ghost btn-sm"
              >
                انصراف
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-danger hover:underline"
            >
              حذف صفحه
            </button>
          )}
        </div>
      )}
    </div>
  )
}
