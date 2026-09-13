'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSettingsAction } from '@/modules/admin/settings-actions'

export function SiteContentEditor({ catalog, initialCopy, initialStyles }: { catalog: Record<string, string>; initialCopy: Record<string, string>; initialStyles: Record<string, { tone?: string; align?: string; hidden?: boolean }> }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [copy, setCopy] = useState(initialCopy); const [styles, setStyles] = useState(initialStyles); const [notice, setNotice] = useState(''); const [query, setQuery] = useState('')
  const save = () => startTransition(async () => { const result = await saveSettingsAction('content', { copy: JSON.stringify(copy), styles: JSON.stringify(styles) }); setNotice(result.ok ? 'تغییرات ذخیره شد.' : result.error); if (result.ok) router.refresh() })
  const normalizedQuery = query.trim().toLocaleLowerCase('fa')
  const entries = Object.entries(catalog).filter(([key, fallback]) => !normalizedQuery || `${key} ${fallback} ${copy[key] ?? ''}`.toLocaleLowerCase('fa').includes(normalizedQuery))
  return <div className="space-y-6">
    <div className="card p-5"><label htmlFor="content-search" className="label">جست‌وجوی صفحه یا المنت</label><input id="content-search" value={query} onChange={(event) => setQuery(event.target.value)} className="field" placeholder="مثلاً درباره ارکید، about یا عنوان" /><p className="hint">{entries.length.toLocaleString('fa-IR')} المنت از {Object.keys(catalog).length.toLocaleString('fa-IR')}</p></div>
    {entries.map(([key, fallback]) => { const style = styles[key] ?? {}; return <section key={key} className="card p-5"><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><div><label className="label">{key}</label><textarea value={copy[key] ?? fallback} onChange={(e) => setCopy({ ...copy, [key]: e.target.value })} className="field min-h-20" /><p className="hint">مقدار پیش‌فرض: {fallback}</p></div><div className="grid grid-cols-3 gap-2 self-start"><select value={style.tone ?? 'plain'} onChange={(e) => setStyles({ ...styles, [key]: { ...style, tone: e.target.value } })} className="field py-2 text-xs"><option value="plain">پس‌زمینه عادی</option><option value="raised">پس‌زمینه برجسته</option><option value="dark">پس‌زمینه تیره</option></select><select value={style.align ?? 'start'} onChange={(e) => setStyles({ ...styles, [key]: { ...style, align: e.target.value } })} className="field py-2 text-xs"><option value="start">راست</option><option value="center">وسط</option><option value="end">چپ</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={style.hidden ?? false} onChange={(e) => setStyles({ ...styles, [key]: { ...style, hidden: e.target.checked } })} />پنهان</label></div></div></section> })}
    {entries.length === 0 && <div className="card p-8 text-center text-sm text-ink-muted">المنتی با این عبارت پیدا نشد.</div>}
    <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-lg"><span className="text-sm text-ink-muted">{notice}</span><button type="button" onClick={save} disabled={pending} className="btn btn-primary">{pending ? 'در حال ذخیره…' : 'ذخیره همه تغییرات'}</button></div>
  </div>
}
