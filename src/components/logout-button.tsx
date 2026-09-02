'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { logoutAction } from '@/modules/auth/actions'

export function LogoutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction()
          router.push('/')
          router.refresh()
        })
      }
      className="w-full text-start px-4 py-3 rounded-lg hover:bg-danger-bg hover:text-danger transition-colors text-[15px]"
    >
      {pending ? 'در حال خروج…' : 'خروج از حساب'}
    </button>
  )
}
