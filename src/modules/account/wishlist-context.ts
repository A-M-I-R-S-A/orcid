import 'server-only'

import { getCurrentUser } from '@/lib/session'
import { wishlistedIds } from './service'

export async function savedProductIds(productIds: number[]): Promise<Set<number>> {
  if (productIds.length === 0) return new Set()

  const user = await getCurrentUser()
  if (!user) return new Set()

  return wishlistedIds(user.id, productIds)
}
