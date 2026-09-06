'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { requireUser } from '@/lib/session'
import { parseOrThrow, reviewSchema } from '@/lib/validation'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import * as reviews from './service'

export async function submitReviewAction(input: {
  productId: number
  rating: number
  title?: string
  body: string
}): Promise<ActionResult<{ isUpdate: boolean }>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(reviewSchema, input)

    const result = await reviews.submit(user.id, {
      productId: parsed.productId,
      rating: parsed.rating,
      title: parsed.title || undefined,
      body: parsed.body,
    })

    const [product] = await db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.id, parsed.productId))
      .limit(1)

    if (product) {
      revalidatePath(`/product/${encodeURIComponent(product.slug)}`)
    }
    revalidatePath('/account/reviews')

    return ok({ isUpdate: result.isUpdate })
  } catch (error) {
    return fail(error, { action: 'submitReview', productId: input.productId })
  }
}
