'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  deleteCategoryAction,
  saveCategoryAction,
  uploadCategoryImageAction,
} from '@/modules/catalog/admin-actions'
import { mediaUrl } from '@/lib/media-url'
import { toPersianDigits } from '@/lib/persian'

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  parentId: number | null
  sortOrder: number
  isVisible: boolean
  imagePath: string | null
  seoTitle: string | null
  seoDescription: string | null
  productCount: number
}

export function CategoryManager({
  categories,
  canEdit,
}: {
  categories: Category[]
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  const roots = categories.filter((c) => c.parentId === null)
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id)

  return (
    <div className="space-y-5">
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(editing === 'new' ? null : 'new')}
          className="btn btn-primary btn-sm"
        >
          {editing === 'new' ? 'انصراف' : 'دسته‌بندی جدید'}
        </button>
      )}

      {editing === 'new' && (
        <CategoryForm
          category={null}
          categories={categories}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="space-y-3">
        {roots.map((category) => (
          <div key={category.id}>
            <CategoryRow
              category={category}
              categories={categories}
              canEdit={canEdit}
              isEditing={editing === category.id}
              onToggle={() => setEditing(editing === category.id ? null : category.id)}
            />

            {childrenOf(category.id).length > 0 && (
              <div className="ms-8 mt-3 space-y-3">
                {childrenOf(category.id).map((child) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    categories={categories}
                    canEdit={canEdit}
                    isEditing={editing === child.id}
                    onToggle={() => setEditing(editing === child.id ? null : child.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  categories,
  canEdit,
  isEditing,
  onToggle,
}: {
  category: Category
  categories: Category[]
  canEdit: boolean
  isEditing: boolean
  onToggle: () => void
}) {
  return (
    <>
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-sunken shrink-0">
          {category.imagePath && (
            <img
              src={mediaUrl(category.imagePath)}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="flex-1 min-w-[140px]">
          <p className="font-medium text-ink">{category.name}</p>
          <p className="text-xs text-ink-subtle truncate">{category.slug}</p>
        </div>

        <span className="text-xs text-ink-muted nums">
          {toPersianDigits(category.productCount)} محصول
        </span>

        <span className={`badge ${category.isVisible ? 'badge-positive' : 'badge-neutral'}`}>
          {category.isVisible ? 'نمایش' : 'پنهان'}
        </span>

        {canEdit && (
          <button type="button" onClick={onToggle} className="btn btn-ghost btn-sm">
            {isEditing ? 'بستن' : 'ویرایش'}
          </button>
        )}
      </div>

      {isEditing && (
        <div className="mt-3">
          <CategoryForm category={category} categories={categories} onDone={onToggle} />
        </div>
      )}
    </>
  )
}

function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category: Category | null
  categories: Category[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const parentOptions = categories.filter(
    (c) => c.id !== category?.id && c.parentId === null,
  )

  return (
    <div className="card p-5 border-accent-3">
      <form
        className="space-y-5"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await saveCategoryAction({
              id: category?.id,
              name: String(formData.get('name') ?? ''),
              slug: String(formData.get('slug') ?? ''),
              description: String(formData.get('description') ?? ''),
              parentId: formData.get('parentId') ? Number(formData.get('parentId')) : null,
              sortOrder: Number(formData.get('sortOrder') ?? 0),
              isVisible: formData.get('isVisible') === 'on',
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
            <label htmlFor="category-name" className="label">نام دسته‌بندی</label>
            <input id="category-name" name="name" required defaultValue={category?.name ?? ''} className="field" />
          </div>

          <div>
            <label htmlFor="category-slug" className="label">نشانی (slug)</label>
            <input
              id="category-slug"
              name="slug"
              defaultValue={category?.slug ?? ''}
              className="field"
              placeholder="خالی بگذارید تا از نام ساخته شود"
            />
          </div>

          <div>
            <label htmlFor="category-parentId" className="label">دسته والد</label>
            <select id="category-parentId" name="parentId" defaultValue={category?.parentId ?? ''} className="field">
              <option value="">بدون والد (سطح اول)</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category-sortOrder" className="label">ترتیب نمایش</label>
            <input
              id="category-sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
              dir="ltr"
              className="field nums"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="category-description" className="label">توضیحات</label>
            <textarea
              id="category-description"
              name="description"
              rows={3}
              defaultValue={category?.description ?? ''}
              className="field resize-y"
            />
            <p className="hint">در بالای صفحه دسته‌بندی نمایش داده می‌شود و برای سئو اهمیت دارد.</p>
          </div>

          <div>
            <label htmlFor="category-seoTitle" className="label">عنوان سئو</label>
            <input id="category-seoTitle" name="seoTitle" defaultValue={category?.seoTitle ?? ''} className="field" />
          </div>

          <div>
            <label htmlFor="category-seoDescription" className="label">توضیحات سئو</label>
            <input
              id="category-seoDescription"
              name="seoDescription"
              defaultValue={category?.seoDescription ?? ''}
              className="field"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isVisible"
            defaultChecked={category?.isVisible ?? true}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          نمایش در فروشگاه
        </label>

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

      {category && (
        <div className="mt-5 pt-5 border-t border-line space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            action={(formData) => {
              formData.set('categoryId', String(category.id))
              startTransition(async () => {
                const result = await uploadCategoryImageAction(formData)
                if (!result.ok) setError(result.error)
                router.refresh()
              })
            }}
          >
            <div>
              <label className="label text-xs">تصویر دسته‌بندی</label>
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
              <span className="text-sm text-danger">این دسته‌بندی حذف شود؟</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteCategoryAction(category.id)
                    if (result.ok) {
                      onDone()
                      router.refresh()
                    } else {
                      setError(result.error)
                      setConfirmDelete(false)
                    }
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
              حذف دسته‌بندی
            </button>
          )}
        </div>
      )}
    </div>
  )
}
