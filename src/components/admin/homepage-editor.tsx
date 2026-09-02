'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  saveHomepageSectionAction,
  uploadHomepageImageAction,
} from '@/modules/admin/content-actions'
import { mediaUrl } from '@/lib/media-url'

interface Section {
  id: number
  kind: string
  label: string
  hint: string
  title: string | null
  subtitle: string | null
  linkUrl: string | null
  linkLabel: string | null
  imagePath: string | null
  isVisible: boolean
  sortOrder: number
  supportsImage: boolean
}

export function HomepageSectionEditor({ section }: { section: Section }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(section.isVisible)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  /** Visibility toggles immediately — it is the most-used control here. */
  const toggleVisible = (next: boolean) => {
    setVisible(next)
    startTransition(async () => {
      await saveHomepageSectionAction({
        id: section.id,
        title: section.title ?? '',
        subtitle: section.subtitle ?? '',
        linkUrl: section.linkUrl ?? '',
        linkLabel: section.linkLabel ?? '',
        isVisible: next,
        sortOrder: section.sortOrder,
      })
      router.refresh()
    })
  }

  return (
    <section className="card overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-4">
        {section.imagePath && (
          <div className="w-16 h-12 rounded-lg overflow-hidden bg-surface-sunken shrink-0">
            <img
              src={mediaUrl(section.imagePath)}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-[160px]">
          <p className="font-medium text-ink">{section.label}</p>
          <p className="text-xs text-ink-subtle mt-0.5">{section.hint}</p>
        </div>

        <span className="text-xs text-ink-muted nums">ترتیب: {section.sortOrder}</span>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => toggleVisible(event.target.checked)}
            disabled={pending}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          نمایش
        </label>

        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm">
          {open ? 'بستن' : 'ویرایش'}
        </button>
      </div>

      {open && (
        <div className="p-5 border-t border-line bg-surface-sunken/30 space-y-5">
          <form
            className="space-y-4"
            action={(formData) => {
              setMessage(null)
              startTransition(async () => {
                const result = await saveHomepageSectionAction({
                  id: section.id,
                  title: String(formData.get('title') ?? ''),
                  subtitle: String(formData.get('subtitle') ?? ''),
                  linkUrl: String(formData.get('linkUrl') ?? ''),
                  linkLabel: String(formData.get('linkLabel') ?? ''),
                  isVisible: visible,
                  sortOrder: Number(formData.get('sortOrder') ?? section.sortOrder),
                })

                setMessage(
                  result.ok
                    ? { tone: 'ok', text: 'ذخیره شد.' }
                    : { tone: 'error', text: result.error },
                )
                if (result.ok) router.refresh()
              })
            }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">عنوان</label>
                <input name="title" defaultValue={section.title ?? ''} className="field" />
              </div>

              <div className="sm:col-span-2">
                <label className="label">زیرعنوان</label>
                <textarea
                  name="subtitle"
                  rows={2}
                  defaultValue={section.subtitle ?? ''}
                  className="field resize-y"
                />
              </div>

              <div>
                <label className="label">نشانی دکمه</label>
                <input
                  name="linkUrl"
                  defaultValue={section.linkUrl ?? ''}
                  dir="ltr"
                  className="field"
                  placeholder="/category/..."
                />
              </div>

              <div>
                <label className="label">متن دکمه</label>
                <input name="linkLabel" defaultValue={section.linkLabel ?? ''} className="field" />
              </div>

              <div>
                <label className="label">ترتیب نمایش</label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={section.sortOrder}
                  dir="ltr"
                  className="field nums"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
                {pending ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
              {message && (
                <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
                  {message.text}
                </p>
              )}
            </div>
          </form>

          {section.supportsImage && (
            <form
              className="flex flex-wrap items-end gap-3 pt-4 border-t border-line"
              action={(formData) => {
                formData.set('sectionId', String(section.id))
                startTransition(async () => {
                  const result = await uploadHomepageImageAction(formData)
                  if (!result.ok) setMessage({ tone: 'error', text: result.error })
                  router.refresh()
                })
              }}
            >
              <div>
                <label className="label text-xs">تصویر بخش</label>
                <input
                  name="file"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="field py-2 text-sm"
                />
              </div>
              <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
                بارگذاری
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
