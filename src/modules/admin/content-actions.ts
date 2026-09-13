'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { blogPosts, homepageSections, pageSections, pages, slugRedirects } from '@/db/schema'
import * as audit from '@/lib/audit'
import { CACHE_TAGS, invalidate } from '@/lib/cache'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { isBannerKind, parseBannerSettings } from '@/lib/banner'
import { deleteImageSet, deleteStored, processUpload } from '@/lib/images'
import { sanitizeHtml } from '@/lib/sanitize'
import { slugify, uniqueSlug } from '@/lib/slug'
import { PAGE_SECTION_BACKGROUNDS, PAGE_SECTION_KINDS, PAGE_SECTION_SPACING, type PageSectionConfig } from '@/lib/page-sections'
import { requirePermission } from './auth'

function validContentLink(value: string): boolean {
  if (!value) return true
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

async function removeNewFiles(files: string[]) {
  await Promise.all(files.map((file) => deleteStored(file).catch(() => {})))
}

export async function saveBannerDesignAction(
  input: { id: number } & Record<string, unknown>,
): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.homepage')

    const [section] = await db
      .select({ id: homepageSections.id, kind: homepageSections.kind, config: homepageSections.config })
      .from(homepageSections)
      .where(eq(homepageSections.id, input.id))
      .limit(1)

    if (!section) throw errors.notFound()
    if (!isBannerKind(section.kind)) {
      throw errors.validation('این تنظیمات فقط برای بخش‌های تصویری است.')
    }

    const existing = (section.config ?? {}) as Record<string, unknown>
    const settings = parseBannerSettings({ ...existing, ...input })

    await db
      .update(homepageSections)
      .set({ config: { ...existing, ...settings } })
      .where(eq(homepageSections.id, input.id))

    await audit.log({
      actor: admin,
      action: 'content.homepage_update',
      entityType: 'homepage_section',
      entityId: input.id,
      metadata: { design: true },
    })

    invalidate(CACHE_TAGS.homepage)
    revalidatePath('/')
    revalidatePath('/admin/homepage')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveHeroDesign', id: input.id })
  }
}

export async function saveHomepageSectionAction(input: {
  id: number
  title?: string
  subtitle?: string
  linkUrl?: string
  linkLabel?: string
  isVisible: boolean
  sortOrder: number
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.homepage')

    if (!Number.isInteger(input.id) || input.id <= 0 || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 10_000) {
      throw errors.validation('شناسه یا ترتیب بخش معتبر نیست.')
    }
    if ((input.title?.length ?? 0) > 300 || (input.subtitle?.length ?? 0) > 2000 || (input.linkLabel?.length ?? 0) > 100) {
      throw errors.validation('متن بخش بیش از حد طولانی است.')
    }
    if (!validContentLink(input.linkUrl?.trim() ?? '')) throw errors.validation('پیوند باید داخلی یا یک نشانی کامل HTTPS باشد.')

    const changed = await db
      .update(homepageSections)
      .set({
        title: input.title?.trim() || null,
        subtitle: input.subtitle?.trim() || null,
        linkUrl: input.linkUrl?.trim() || null,
        linkLabel: input.linkLabel?.trim() || null,
        isVisible: input.isVisible,
        sortOrder: input.sortOrder,
      })
      .where(eq(homepageSections.id, input.id))
    if (affectedRows(changed) === 0) throw errors.notFound()

    await audit.log({
      actor: admin,
      action: 'content.homepage_update',
      entityType: 'homepage_section',
      entityId: input.id,
    })

    invalidate(CACHE_TAGS.homepage)
    revalidatePath('/')
    revalidatePath('/admin/homepage')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveHomepageSection', id: input.id })
  }
}

export async function uploadHomepageImageAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    await requirePermission('content.homepage')

    const sectionId = Number(formData.get('sectionId'))
    const file = formData.get('file')

    if (!Number.isInteger(sectionId) || sectionId <= 0) throw errors.validation('بخش نامعتبر است.')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const [section] = await db.select({ id: homepageSections.id, imagePath: homepageSections.imagePath }).from(homepageSections).where(eq(homepageSections.id, sectionId)).limit(1)
    if (!section) throw errors.notFound()

    const processed = await processUpload(file, { folder: 'homepage' })
    try {
      const changed = await db.update(homepageSections).set({ imagePath: processed.path }).where(eq(homepageSections.id, sectionId))
      if (affectedRows(changed) === 0) throw errors.conflict('بخش هم‌زمان تغییر کرده است.')
    } catch (error) {
      await removeNewFiles(processed.files)
      throw error
    }
    if (section.imagePath) await deleteImageSet(section.imagePath)

    invalidate(CACHE_TAGS.homepage)
    revalidatePath('/')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'uploadHomepageImage' })
  }
}

export async function savePageAction(input: {
  id?: number
  slug: string
  title: string
  body: string
  isPublished: boolean
  showInFooter: boolean
  sortOrder: number
  seoTitle?: string
  seoDescription?: string
}): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('content.pages')

    if (!input.title.trim()) throw errors.validation('عنوان صفحه الزامی است.')

    const body = sanitizeHtml(input.body)

    if (input.id) {
      const [existing] = await db.select().from(pages).where(eq(pages.id, input.id)).limit(1)
      if (!existing) throw errors.notFound()

      let slug = existing.slug
      if (input.slug && slugify(input.slug) !== existing.slug) {
        slug = await uniqueSlug(input.slug, async (candidate) => {
          const [conflict] = await db
            .select({ id: pages.id })
            .from(pages)
            .where(eq(pages.slug, candidate))
            .limit(1)
          return Boolean(conflict) && conflict!.id !== input.id
        })

        await db
          .insert(slugRedirects)
          .values({ entityType: 'page', oldSlug: existing.slug, newSlug: slug })
          .onDuplicateKeyUpdate({ set: { newSlug: slug } })
      }

      await db
        .update(pages)
        .set({
          slug,
          title: input.title,
          body,
          isPublished: input.isPublished,
          showInFooter: input.showInFooter,
          sortOrder: input.sortOrder,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
        })
        .where(eq(pages.id, input.id))

      await audit.log({
        actor: admin,
        action: 'content.page_update',
        entityType: 'page',
        entityId: input.id,
        summary: input.title,
      })

      invalidate(CACHE_TAGS.pages, CACHE_TAGS.sitemap)
      revalidatePath(`/p/${encodeURIComponent(slug)}`)
      revalidatePath('/', 'layout')
      return ok({ id: input.id })
    }

    const slug = await uniqueSlug(input.slug || input.title, async (candidate) => {
      const [conflict] = await db
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.slug, candidate))
        .limit(1)
      return Boolean(conflict)
    })

    const [inserted] = await db.insert(pages).values({
      slug,
      title: input.title,
      body,
      isPublished: input.isPublished,
      showInFooter: input.showInFooter,
      sortOrder: input.sortOrder,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    })

    const id = (inserted as unknown as { insertId: number }).insertId

    await audit.log({
      actor: admin,
      action: 'content.page_update',
      entityType: 'page',
      entityId: id,
      summary: `ایجاد صفحه: ${input.title}`,
    })

    invalidate(CACHE_TAGS.pages, CACHE_TAGS.sitemap)
    revalidatePath('/', 'layout')
    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'savePage' })
  }
}

export async function uploadPageImageAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    await requirePermission('content.pages')

    const pageId = Number(formData.get('pageId'))
    const file = formData.get('file')

    if (!Number.isInteger(pageId) || pageId <= 0) throw errors.validation('صفحه نامعتبر است.')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const [page] = await db
      .select({ id: pages.id, slug: pages.slug, imagePath: pages.imagePath })
      .from(pages)
      .where(eq(pages.id, pageId))
      .limit(1)

    if (!page) throw errors.notFound()

    const processed = await processUpload(file, { folder: 'pages' })

    try {
      const changed = await db.update(pages).set({ imagePath: processed.path }).where(eq(pages.id, pageId))
      if (affectedRows(changed) === 0) throw errors.conflict('صفحه هم‌زمان تغییر کرده است.')
    } catch (error) {
      await removeNewFiles(processed.files)
      throw error
    }
    if (page.imagePath) await deleteImageSet(page.imagePath)

    invalidate(CACHE_TAGS.pages)
    revalidatePath(`/p/${page.slug}`)
    revalidatePath('/product/[slug]', 'page')
    revalidatePath('/admin/pages')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'uploadPageImage' })
  }
}

export async function deletePageAction(pageId: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('content.pages')
    await db.delete(pages).where(eq(pages.id, pageId))
    invalidate(CACHE_TAGS.pages, CACHE_TAGS.sitemap)
    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deletePage', pageId })
  }
}

export async function saveBlogPostAction(input: {
  id?: number
  title: string
  slug: string
  excerpt?: string
  body: string
  categoryId?: number | null
  isPublished: boolean
  seoTitle?: string
  seoDescription?: string
  coverImageAlt?: string
}): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('blog.manage')

    if (!input.title.trim()) throw errors.validation('عنوان نوشته الزامی است.')

    const body = sanitizeHtml(input.body)

    if (input.id) {
      const [existing] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.id, input.id))
        .limit(1)

      if (!existing) throw errors.notFound()

      let slug = existing.slug
      if (input.slug && slugify(input.slug) !== existing.slug) {
        slug = await uniqueSlug(input.slug, async (candidate) => {
          const [conflict] = await db
            .select({ id: blogPosts.id })
            .from(blogPosts)
            .where(eq(blogPosts.slug, candidate))
            .limit(1)
          return Boolean(conflict) && conflict!.id !== input.id
        })

        await db
          .insert(slugRedirects)
          .values({ entityType: 'blog_post', oldSlug: existing.slug, newSlug: slug })
          .onDuplicateKeyUpdate({ set: { newSlug: slug } })
      }

      await db
        .update(blogPosts)
        .set({
          title: input.title,
          slug,
          excerpt: input.excerpt || null,
          body,
          categoryId: input.categoryId ?? null,
          isPublished: input.isPublished,
          publishedAt: input.isPublished ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
          coverImageAlt: input.coverImageAlt || null,
        })
        .where(eq(blogPosts.id, input.id))

      await audit.log({
        actor: admin,
        action: input.isPublished && !existing.isPublished ? 'blog.publish' : 'blog.update',
        entityType: 'blog_post',
        entityId: input.id,
        summary: input.title,
      })

      invalidate(CACHE_TAGS.blog, CACHE_TAGS.sitemap)
      revalidatePath(`/blog/${encodeURIComponent(slug)}`)
      revalidatePath('/blog')
      revalidatePath('/')
      return ok({ id: input.id })
    }

    const slug = await uniqueSlug(input.slug || input.title, async (candidate) => {
      const [conflict] = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.slug, candidate))
        .limit(1)
      return Boolean(conflict)
    })

    const [inserted] = await db.insert(blogPosts).values({
      title: input.title,
      slug,
      excerpt: input.excerpt || null,
      body,
      categoryId: input.categoryId ?? null,
      authorAdminId: admin.id,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date() : null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      coverImageAlt: input.coverImageAlt || null,
    })

    const id = (inserted as unknown as { insertId: number }).insertId

    await audit.log({
      actor: admin,
      action: input.isPublished ? 'blog.publish' : 'blog.update',
      entityType: 'blog_post',
      entityId: id,
      summary: input.title,
    })

    invalidate(CACHE_TAGS.blog, CACHE_TAGS.sitemap)
    revalidatePath('/blog')
    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'saveBlogPost' })
  }
}

export async function uploadBlogCoverAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    await requirePermission('blog.manage')

    const postId = Number(formData.get('postId'))
    const file = formData.get('file')

    if (!Number.isInteger(postId) || postId <= 0) throw errors.validation('نوشته نامعتبر است.')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const [post] = await db.select({ id: blogPosts.id, coverImagePath: blogPosts.coverImagePath }).from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)
    if (!post) throw errors.notFound()

    const processed = await processUpload(file, { folder: 'blog' })
    try {
      const changed = await db.update(blogPosts).set({ coverImagePath: processed.path }).where(eq(blogPosts.id, postId))
      if (affectedRows(changed) === 0) throw errors.conflict('نوشته هم‌زمان تغییر کرده است.')
    } catch (error) {
      await removeNewFiles(processed.files)
      throw error
    }
    if (post.coverImagePath) await deleteImageSet(post.coverImagePath)

    invalidate(CACHE_TAGS.blog)
    revalidatePath('/blog')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'uploadBlogCover' })
  }
}

export async function savePageSectionAction(input: {
  id?: number
  pageId: number
  kind: string
  name: string
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  imagePath?: string
  linkLabel?: string
  linkUrl?: string
  config?: PageSectionConfig
  background: string
  spacing: string
  isVisible: boolean
  sortOrder: number
}): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('content.pages')
    if (!Number.isInteger(input.pageId) || input.pageId <= 0) throw errors.validation('صفحه معتبر نیست.')
    if (!PAGE_SECTION_KINDS.includes(input.kind as never)) throw errors.validation('نوع بخش معتبر نیست.')
    if (!PAGE_SECTION_BACKGROUNDS.includes(input.background as never)) throw errors.validation('پس‌زمینه معتبر نیست.')
    if (!PAGE_SECTION_SPACING.includes(input.spacing as never)) throw errors.validation('فاصله بخش معتبر نیست.')
    if (!input.name.trim() || input.name.length > 120) throw errors.validation('نام بخش معتبر نیست.')
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 10_000) throw errors.validation('ترتیب بخش معتبر نیست.')
    if ((input.title?.length ?? 0) > 300 || (input.subtitle?.length ?? 0) > 1000 || (input.body?.length ?? 0) > 50_000) throw errors.validation('محتوای بخش بیش از حد طولانی است.')
    if (!validContentLink(input.linkUrl?.trim() ?? '')) throw errors.validation('پیوند باید داخلی یا HTTPS باشد.')

    const [existing] = input.id
      ? await db.select({ config: pageSections.config }).from(pageSections).where(eq(pageSections.id, input.id)).limit(1)
      : []
    const values = {
      pageId: input.pageId,
      kind: input.kind as (typeof PAGE_SECTION_KINDS)[number],
      name: input.name.trim(),
      eyebrow: input.eyebrow?.trim() || null,
      title: input.title?.trim() || null,
      subtitle: input.subtitle?.trim() || null,
      body: input.body ? sanitizeHtml(input.body) : null,
      imagePath: input.imagePath?.trim() || null,
      linkLabel: input.linkLabel?.trim() || null,
      linkUrl: input.linkUrl?.trim() || null,
      config: { ...(existing?.config ?? {}), ...(input.config ?? {}) },
      background: input.background as (typeof PAGE_SECTION_BACKGROUNDS)[number],
      spacing: input.spacing as (typeof PAGE_SECTION_SPACING)[number],
      isVisible: input.isVisible,
      sortOrder: input.sortOrder,
    }

    let id = input.id
    if (id) {
      const changed = await db.update(pageSections).set(values).where(eq(pageSections.id, id))
      if (affectedRows(changed) === 0) throw errors.notFound()
    } else {
      const [inserted] = await db.insert(pageSections).values(values)
      id = (inserted as unknown as { insertId: number }).insertId
    }

    await audit.log({ actor: admin, action: 'content.page_update', entityType: 'page_section', entityId: id, metadata: { pageId: input.pageId, kind: input.kind } })
    invalidate(CACHE_TAGS.pages)
    revalidatePath('/p/[slug]', 'page')
    revalidatePath('/admin/pages')
    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'savePageSection', pageId: input.pageId, id: input.id })
  }
}

export async function deletePageSectionAction(id: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('content.pages')
    if (!Number.isInteger(id) || id <= 0) throw errors.validation('بخش معتبر نیست.')
    const [existing] = await db.select({ config: pageSections.config }).from(pageSections).where(eq(pageSections.id, id)).limit(1)
    if (!existing) throw errors.notFound()
    if ((existing.config as PageSectionConfig | null)?.locked) throw errors.validation('بخش‌های اصلی صفحه قابل حذف نیستند؛ می‌توانید آن‌ها را مخفی کنید.')
    await db.delete(pageSections).where(eq(pageSections.id, id))
    invalidate(CACHE_TAGS.pages)
    revalidatePath('/p/[slug]', 'page')
    revalidatePath('/admin/pages')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deletePageSection', id })
  }
}

export async function uploadPageSectionImageAction(formData: FormData): Promise<ActionResult<{ path: string }>> {
  try {
    await requirePermission('content.pages')
    const file = formData.get('file')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')
    const processed = await processUpload(file, { folder: 'pages' })
    return ok({ path: processed.path })
  } catch (error) {
    return fail(error, { action: 'uploadPageSectionImage' })
  }
}

export async function uploadContentImageAction(
  formData: FormData,
): Promise<ActionResult<{ path: string; html: string }>> {
  try {
    const kind = String(formData.get('kind') ?? '')
    if (kind === 'blog') await requirePermission('blog.manage')
    else if (kind === 'page') await requirePermission('content.pages')
    else if (kind === 'product') await requirePermission('products.update')
    else throw errors.validation('نوع محتوا معتبر نیست.')
    const file = formData.get('file')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')
    const processed = await processUpload(file, { folder: kind === 'blog' ? 'blog' : kind === 'product' ? 'products' : 'pages' })
    return ok({ path: processed.path, html: `<img src="/api/media/${processed.path}" alt="" loading="lazy">` })
  } catch (error) {
    return fail(error, { action: 'uploadContentImage' })
  }
}

export async function deleteBlogPostAction(postId: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('blog.manage')
    await db.delete(blogPosts).where(eq(blogPosts.id, postId))
    invalidate(CACHE_TAGS.blog, CACHE_TAGS.sitemap)
    revalidatePath('/blog')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteBlogPost', postId })
  }
}
