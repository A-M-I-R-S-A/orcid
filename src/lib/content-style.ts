export type ContentStyle = {
  tone?: 'plain' | 'raised' | 'dark'
  align?: 'start' | 'center' | 'end'
  hidden?: boolean
}

export function contentStyleClass(style: ContentStyle | undefined): string {
  if (!style) return ''
  return [
    style.hidden ? 'hidden' : '',
    style.align === 'center'
      ? 'text-center'
      : style.align === 'end'
        ? 'text-left'
        : style.align === 'start'
          ? 'text-right'
          : '',
    style.tone === 'raised'
      ? 'rounded-[var(--radius-card)] bg-surface-raised px-4 py-3'
      : style.tone === 'dark'
        ? 'rounded-[var(--radius-card)] bg-ink px-4 py-3 text-bg'
        : '',
  ]
    .filter(Boolean)
    .join(' ')
}
