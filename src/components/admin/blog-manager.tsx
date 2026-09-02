'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  deleteBlogPostAction,
  saveBlogPostAction,
  uploadBlogCoverAction,
} from '@/modules/admin/content-actions'
import { formatJalali } from '@/lib/jalali'
import { mediaUrl } from '@/lib/media-url'

interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  body: string
  categoryId: number | null
  isPublished: boolean
  publishedAt: Date | null
  coverImagePath: string | null
  coverImageAlt: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export function BlogManager({
  posts,
  categories,
}: {
  posts: Post[]
  categories: { id: number; name: string }[]
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditing(editing === 'new' ? null : 'new')}
        className="btn btn-primary btn-sm"
      >
        {editing === 'new' ? 'انصراف' : 'نوشته جدید'}
      </button>

      {editing === 'new' && (
        <PostForm post={null} categories={categories} onDone={() => setEditing(null)} />
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id}>
            <div className="card p-4 flex flex-wrap items-center gap-4">
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-surface-sunken shrink-0">
                {post.coverImagePath && (
                  <img
                    src={mediaUrl(post.coverImagePath)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-[160px]">
                <p className="font-medium text-ink">{post.title}</p>
                <p className="text-xs text-ink-subtle truncate">
                  /blog/{post.slug}
                  {post.publishedAt && (
                    <span className="nums"> — {formatJalali(post.publishedAt)}</span>
                  )}
                </p>
              </div>

              <span className={`badge ${post.isPublished ? 'badge-positive' : 'badge-pending'}`}>
                {post.isPublished ? 'منتشر شده' : 'پیش‌نویس'}
              </span>

              {post.isPublished && (
                <Link
                  href={`/blog/${encodeURIComponent(post.slug)}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-accent-2 hover:underline"
                >
                  مشاهده ↗
                </Link>
              )}

              <button
                type="button"
                onClick={() => setEditing(editing === post.id ? null : post.id)}
                className="btn btn-ghost btn-sm"
              >
                {editing === post.id ? 'بستن' : 'ویرایش'}
              </button>
            </div>

            {editing === post.id && (
              <div className="mt-3">
                <PostForm post={post} categories={categories} onDone={() => setEditing(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PostForm({
  post,
  categories,
  onDone,
}: {
  post: Post | null
  categories: { id: number; name: string }[]
  onDone: () => void
}) {
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
            const result = await saveBlogPostAction({
              id: post?.id,
              title: String(formData.get('title') ?? ''),
              slug: String(formData.get('slug') ?? ''),
              excerpt: String(formData.get('excerpt') ?? ''),
              body: String(formData.get('body') ?? ''),
              categoryId: formData.get('categoryId') ? Number(formData.get('categoryId')) : null,
              isPublished: formData.get('isPublished') === 'on',
              seoTitle: String(formData.get('seoTitle') ?? ''),
              seoDescription: String(formData.get('seoDescription') ?? ''),
              coverImageAlt: String(formData.get('coverImageAlt') ?? ''),
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
          <div className="sm:col-span-2">
            <label className="label">عنوان</label>
            <input name="title" required defaultValue={post?.title ?? ''} className="field" />
          </div>

          <div>
            <label className="label">نشانی (slug)</label>
            <input
              name="slug"
              defaultValue={post?.slug ?? ''}
              className="field"
              placeholder="خالی بگذارید تا از عنوان ساخته شود"
            />
          </div>

          <div>
            <label className="label">دسته‌بندی</label>
            <select name="categoryId" defaultValue={post?.categoryId ?? ''} className="field">
              <option value="">بدون دسته‌بندی</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">خلاصه</label>
            <textarea
              name="excerpt"
              rows={2}
              maxLength={320}
              defaultValue={post?.excerpt ?? ''}
              className="field resize-y"
            />
            <p className="hint">در فهرست وبلاگ و به‌عنوان توضیحات پیش‌فرض سئو استفاده می‌شود.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="label">متن نوشته</label>
            <textarea
              name="body"
              rows={14}
              defaultValue={post?.body ?? ''}
              className="field resize-y font-mono text-sm"
              dir="auto"
            />
          </div>

          <div>
            <label className="label">عنوان سئو</label>
            <input name="seoTitle" defaultValue={post?.seoTitle ?? ''} className="field" />
          </div>

          <div>
            <label className="label">توضیحات سئو</label>
            <input
              name="seoDescription"
              defaultValue={post?.seoDescription ?? ''}
              className="field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">متن جایگزین تصویر شاخص</label>
            <input
              name="coverImageAlt"
              defaultValue={post?.coverImageAlt ?? ''}
              className="field"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={post?.isPublished ?? false}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          منتشر شده
        </label>
        {post?.publishedAt && (
          <p className="hint -mt-3">
            تاریخ انتشار اولیه حفظ می‌شود و با ویرایش تغییر نمی‌کند.
          </p>
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

      {post && (
        <div className="mt-5 pt-5 border-t border-line space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            action={(formData) => {
              formData.set('postId', String(post.id))
              startTransition(async () => {
                const result = await uploadBlogCoverAction(formData)
                if (!result.ok) setError(result.error)
                router.refresh()
              })
            }}
          >
            <div>
              <label className="label text-xs">تصویر شاخص</label>
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

          {confirmDelete ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-danger">این نوشته حذف شود؟</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteBlogPostAction(post.id)
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
              حذف نوشته
            </button>
          )}
        </div>
      )}
    </div>
  )
}
