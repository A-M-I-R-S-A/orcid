'use client'

import { useRef, useState, useTransition } from 'react'

import { uploadContentImageAction } from '@/modules/admin/content-actions'

export function ContentImageUpload({ kind, textareaId }: { kind: 'blog' | 'page'; textareaId: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return <div className="rounded-md border border-dashed border-line bg-surface-sunken p-3"><div className="flex flex-wrap items-center gap-3"><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="field max-w-xs py-2 text-sm" /><button type="button" disabled={pending} className="btn btn-secondary btn-sm" onClick={() => { const file = ref.current?.files?.[0]; if (!file) { setMessage('ابتدا یک تصویر انتخاب کنید.'); return } const data = new FormData(); data.set('kind', kind); data.set('file', file); startTransition(async () => { const result = await uploadContentImageAction(data); if (!result.ok) { setMessage(result.error); return } const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null; if (!textarea) { setMessage('تصویر بارگذاری شد؛ نشانی آن را از نو باز کنید.'); return } const start = textarea.selectionStart; const end = textarea.selectionEnd; textarea.setRangeText(`\n${result.data.html}\n`, start, end, 'end'); textarea.dispatchEvent(new Event('input', { bubbles: true })); if (ref.current) ref.current.value = ''; setMessage('تصویر بارگذاری و در محل نشانگر درج شد. برای ثبت نهایی، محتوا را ذخیره کنید.') }) }}> {pending ? 'در حال بارگذاری…' : 'بارگذاری و درج در متن'} </button></div><p className="hint mt-2">نشانگر را در متن بگذارید؛ تگ &lt;img&gt; همان‌جا درج می‌شود. برای تصویر دیگر دوباره بارگذاری کنید.</p>{message && <p className="mt-2 text-sm text-ink-muted">{message}</p>}</div>
}
