'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import {
  deletePageAction,
  savePageAction,
  uploadPageImageAction,
} from '@/modules/admin/content-actions'
import { mediaUrl } from '@/lib/media-url'
import { SIZE_GUIDE_SLUG } from '@/lib/size-guide'
import { ContentImageUpload } from '@/components/admin/content-image-upload'

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
  imagePath: string | null
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
  const fileRef = useRef<HTMLInputElement>(null)

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
            <label htmlFor="page-title" className="label">عنوان صفحه</label>
            <input id="page-title" name="title" required defaultValue={page?.title ?? ''} className="field" />
          </div>

          <div>
            <label htmlFor="page-slug" className="label">نشانی (slug)</label>
            <input
              id="page-slug"
              name="slug"
              defaultValue={page?.slug ?? ''}
              className="field"
              placeholder="خالی بگذارید تا از عنوان ساخته شود"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="page-body" className="label">محتوا</label>
            <textarea
              id="page-body"
              name="body"
              rows={12}
              defaultValue={page?.body ?? ''}
              className="field resize-y font-mono text-sm"
              dir="auto"
            />
            <ContentImageUpload kind="page" textareaId="page-body" />
            <p className="hint">
              HTML، تصویر و بلوک‌های &lt;style&gt; مجاز هستند. CSS فقط برای نمایش محلی محتواست؛ کدهای ناامن و بارگذاری بیرونی حذف می‌شوند.
            </p>
          </div>

          <div>
            <label htmlFor="page-seoTitle" className="label">عنوان سئو</label>
            <input id="page-seoTitle" name="seoTitle" defaultValue={page?.seoTitle ?? ''} className="field" />
          </div>

          <div>
            <label htmlFor="page-seoDescription" className="label">توضیحات سئو</label>
            <input
              id="page-seoDescription"
              name="seoDescription"
              defaultValue={page?.seoDescription ?? ''}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="page-sortOrder" className="label">ترتیب در فوتر</label>
            <input
              id="page-sortOrder"
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

        {page && (
          <div className="border-t border-line pt-5">
            <label htmlFor="page-image" className="label">
              تصویر صفحه
              {page.slug === SIZE_GUIDE_SLUG && (
                <span className="font-normal text-ink-muted">
                  {' — '}
                  همین تصویر در پنجرهٔ راهنمای سایز صفحهٔ محصولات نمایش داده می‌شود
                </span>
              )}
            </label>

            <div className="flex flex-wrap items-end gap-4">
              {page.imagePath && (
                <img
                  src={mediaUrl(page.imagePath)}
                  alt=""
                  className="h-24 w-auto rounded-md border border-line bg-surface-sunken object-contain"
                />
              )}

              <div className="flex flex-wrap items-end gap-3">
                <input
                  id="page-image"
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="field py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const file = fileRef.current?.files?.[0]
                    if (!file) return
                    const data = new FormData()
                    data.set('pageId', String(page.id))
                    data.set('file', file)
                    startTransition(async () => {
                      const result = await uploadPageImageAction(data)
                      if (!result.ok) setError(result.error)
                      else {
                        setError(null)
                        if (fileRef.current) fileRef.current.value = ''
                      }
                      router.refresh()
                    })
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  بارگذاری
                </button>
              </div>
            </div>
            <p className="hint">
              تصویر بدون برش نمایش داده می‌شود؛ جدولی که لبه‌هایش عدد دارد کامل دیده می‌شود.
            </p>
          </div>
        )}

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
