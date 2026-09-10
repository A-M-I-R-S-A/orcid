'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { NAV_PLACEMENTS, type NavPlacement, navLinks } from '@/db/schema'
import * as audit from '@/lib/audit'
import { CACHE_TAGS, invalidate } from '@/lib/cache'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { processUpload } from '@/lib/images'
import { navLinkSchema } from '@/lib/validation'
import { getNamespace, setSetting } from '@/lib/settings'
import { requirePermission } from './auth'

function assertPlacement(value: unknown): NavPlacement {
  if (typeof value !== 'string' || !NAV_PLACEMENTS.includes(value as NavPlacement)) {
    throw errors.validation('جایگاه انتخاب‌شده معتبر نیست.')
  }
  return value as NavPlacement
}

function refresh(): void {
  invalidate(CACHE_TAGS.navigation)
  revalidatePath('/', 'layout')
  revalidatePath('/admin/navigation')
}

export async function createNavLinkAction(input: {
  placement: string
  label: string
  href: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.navigation')
    const placement = assertPlacement(input.placement)
    const parsed = navLinkSchema.safeParse({ label: input.label, href: input.href })

    if (!parsed.success) {
      throw errors.validation(parsed.error.issues[0]?.message ?? 'اطلاعات وارد شده معتبر نیست.')
    }

    const [row] = await db
      .select({ next: sql<number>`COALESCE(MAX(${navLinks.sortOrder}), -1) + 1` })
      .from(navLinks)
      .where(eq(navLinks.placement, placement))

    const inserted = await db.insert(navLinks).values({
      placement,
      label: parsed.data.label,
      href: parsed.data.href,
      sortOrder: Number(row?.next ?? 0),
    })

    await audit.log({
      actor: admin,
      action: 'content.navigation_update',
      entityType: 'nav_link',
      entityId: (inserted as unknown as { insertId: number }).insertId,
      metadata: { placement, label: parsed.data.label, href: parsed.data.href },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'createNavLink' })
  }
}

export async function updateNavLinkAction(input: {
  id: number
  label: string
  href: string
  isVisible: boolean
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.navigation')
    const parsed = navLinkSchema.safeParse({ label: input.label, href: input.href })

    if (!parsed.success) {
      throw errors.validation(parsed.error.issues[0]?.message ?? 'اطلاعات وارد شده معتبر نیست.')
    }

    const [existing] = await db
      .select({ id: navLinks.id })
      .from(navLinks)
      .where(eq(navLinks.id, input.id))
      .limit(1)

    if (!existing) throw errors.notFound()

    await db
      .update(navLinks)
      .set({ label: parsed.data.label, href: parsed.data.href, isVisible: input.isVisible })
      .where(eq(navLinks.id, input.id))

    await audit.log({
      actor: admin,
      action: 'content.navigation_update',
      entityType: 'nav_link',
      entityId: input.id,
      metadata: { label: parsed.data.label, href: parsed.data.href, isVisible: input.isVisible },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateNavLink', id: input.id })
  }
}

export async function deleteNavLinkAction(id: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.navigation')

    const [existing] = await db
      .select({ id: navLinks.id, label: navLinks.label, placement: navLinks.placement })
      .from(navLinks)
      .where(eq(navLinks.id, id))
      .limit(1)

    if (!existing) throw errors.notFound()

    await db.delete(navLinks).where(eq(navLinks.id, id))

    await audit.log({
      actor: admin,
      action: 'content.navigation_update',
      entityType: 'nav_link',
      entityId: id,
      metadata: { label: existing.label, placement: existing.placement },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteNavLink', id })
  }
}

export async function moveNavLinkAction(
  id: number,
  direction: 'up' | 'down',
): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('content.navigation')

    const [current] = await db
      .select({
        id: navLinks.id,
        placement: navLinks.placement,
        sortOrder: navLinks.sortOrder,
      })
      .from(navLinks)
      .where(eq(navLinks.id, id))
      .limit(1)

    if (!current) throw errors.notFound()

    const siblings = await db
      .select({ id: navLinks.id, sortOrder: navLinks.sortOrder })
      .from(navLinks)
      .where(eq(navLinks.placement, current.placement))
      .orderBy(navLinks.sortOrder, navLinks.id)

    const index = siblings.findIndex((s) => s.id === id)
    const target = direction === 'up' ? index - 1 : index + 1

    if (index === -1 || target < 0 || target >= siblings.length) {
      return ok(undefined)
    }

    const reordered = [...siblings]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved!)

    await db.transaction(async (tx) => {
      for (const [position, row] of reordered.entries()) {
        await tx.update(navLinks).set({ sortOrder: position }).where(eq(navLinks.id, row.id))
      }
    })

    await audit.log({
      actor: admin,
      action: 'content.navigation_update',
      entityType: 'nav_link',
      entityId: id,
      metadata: { moved: direction },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'moveNavLink', id })
  }
}

export async function seedNavFromCategoriesAction(
  placement: string,
): Promise<ActionResult<{ added: number }>> {
  try {
    const admin = await requirePermission('content.navigation')
    const target = assertPlacement(placement)

    const { listCategories } = await import('@/modules/catalog/queries')
    const categories = await listCategories()
    const topLevel = categories.filter((c) => c.parentId === null)

    const existing = await db
      .select({ href: navLinks.href })
      .from(navLinks)
      .where(eq(navLinks.placement, target))

    const taken = new Set(existing.map((e) => e.href))

    const [row] = await db
      .select({ next: sql<number>`COALESCE(MAX(${navLinks.sortOrder}), -1) + 1` })
      .from(navLinks)
      .where(eq(navLinks.placement, target))

    let order = Number(row?.next ?? 0)
    let added = 0

    for (const category of topLevel) {
      const href = `/category/${encodeURIComponent(category.slug)}`
      if (taken.has(href)) continue

      await db.insert(navLinks).values({
        placement: target,
        label: category.name.slice(0, 60),
        href,
        sortOrder: order++,
      })
      added++
    }

    await audit.log({
      actor: admin,
      action: 'content.navigation_update',
      entityType: 'nav_link',
      metadata: { placement: target, seededFromCategories: added },
    })

    refresh()
    return ok({ added })
  } catch (error) {
    return fail(error, { action: 'seedNavFromCategories' })
  }
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('appearance.brand')
    const file = formData.get('file')

    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const processed = await processUpload(file, { folder: 'brand' })

    await setSetting('site', 'logoPath', processed.path)

    await audit.log({
      actor: admin,
      action: 'brand.change',
      entityType: 'setting',
      metadata: { logoPath: processed.path },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'uploadLogo' })
  }
}

export async function clearLogoAction(): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('appearance.brand')
    const site = await getNamespace('site')

    if (!site.logoPath) return ok(undefined)

    await setSetting('site', 'logoPath', '')

    await audit.log({
      actor: admin,
      action: 'brand.change',
      entityType: 'setting',
      metadata: { logoPath: null },
    })

    refresh()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'clearLogo' })
  }
}
