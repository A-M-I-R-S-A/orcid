'use client'
import { createContext, useContext, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { contentStyleClass, type ContentStyle } from '@/lib/content-style'
const CopyContext = createContext<Record<string, string>>({})
const StyleContext = createContext<Record<string, ContentStyle>>({})
export function SiteContentProvider({ copy, styles, children }: { copy: Record<string, string>; styles: Record<string, ContentStyle>; children: React.ReactNode }) {
  const pathname = usePathname()
  return <CopyContext.Provider value={copy}><StyleContext.Provider value={styles}>{!pathname.startsWith('/admin') && <ContentStyleFallback copy={copy} styles={styles} />}{children}</StyleContext.Provider></CopyContext.Provider>
}
export function useSiteText(key: string, fallback: string): string { const copy = useContext(CopyContext); return copy[key]?.trim() || fallback }
export function useSiteStyleClass(key: string): string { return contentStyleClass(useContext(StyleContext)[key]) }
export function SiteStyledText({ contentKey, children }: { contentKey: string; children: React.ReactNode }) {
  return <span data-content-key={contentKey} className={useSiteStyleClass(contentKey)}>{children}</span>
}

function ContentStyleFallback({ copy, styles }: { copy: Record<string, string>; styles: Record<string, ContentStyle> }) {
  useEffect(() => {
    const entries = Object.entries(styles)
      .filter(([, style]) => contentStyleClass(style))
      .map(([key, style]) => ({ key, value: copy[key]?.trim(), classes: contentStyleClass(style).split(' ') }))
      .filter((entry) => entry.value)
    if (entries.length === 0) return

    const byValue = new Map(entries.map((entry) => [entry.value, entry]))
    const apply = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const value = node.textContent?.trim()
        const parent = node.parentElement
        const entry = value ? byValue.get(value) : undefined
        if (entry && parent && !parent.closest('[data-content-key]') && !parent.closest('script,style')) {
          parent.dataset.contentKey = entry.key
          parent.classList.add(...entry.classes)
        }
        node = walker.nextNode()
      }
    }
    apply(document.body)
    const observer = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) apply(node)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [copy, styles])
  return null
}
