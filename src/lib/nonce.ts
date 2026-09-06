import 'server-only'

import { headers } from 'next/headers'

export async function getNonce(): Promise<string> {
  const list = await headers()
  return list.get('x-nonce') ?? ''
}
