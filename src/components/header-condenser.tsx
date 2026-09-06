'use client'

import { useEffect, useRef } from 'react'

export function HeaderCondenser() {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = sentinel.current
    const header = document.getElementById('site-header')
    if (!node || !header) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        header.dataset.condensed = String(!(entry?.isIntersecting ?? true))
      },
      {
        rootMargin: '64px 0px 0px 0px',
        threshold: 0,
      },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
      delete header.dataset.condensed
    }
  }, [])

  return <div ref={sentinel} aria-hidden="true" className="h-px w-full" />
}
