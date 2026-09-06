'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function SearchField() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')

  return (
    <form
      action="/search"
      method="get"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        const query = value.trim()
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`)
      }}
      className="relative"
    >
      <label htmlFor="site-search" className="sr-only">
        جستجو در محصولات
      </label>

      <input
        id="site-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جستجو در محصولات…"
        autoComplete="off"
        className="field ps-11 py-2.5 text-[15px] rounded-full"
      />

      <button
        type="submit"
        className="absolute inset-y-0 start-0 ps-4 flex items-center text-ink-subtle hover:text-accent-2 transition-colors"
        aria-label="جستجو"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
    </form>
  )
}
