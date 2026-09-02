'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { saveSettingsAction } from '@/modules/admin/settings-actions'
import type { Namespace } from '@/lib/settings'

interface Field {
  key: string
  label: string
  value: string
  hint?: string
  dir?: 'ltr' | 'rtl'
  multiline?: boolean
  /** Rendered as a password field, never populated with the stored value. */
  secret?: boolean
  /** Whether a credential already exists, for the placeholder text. */
  isSet?: boolean
}

/**
 * Generic settings section.
 *
 * Secret handling is the part worth reading. §47 requires credentials to be
 * masked, so the stored value is never sent to the browser at all — the input
 * starts empty and a BLANK value means "leave unchanged" on the server.
 *
 * That has a consequence worth being explicit about in the UI: an operator
 * editing the bank name on a form that also contains an API key must not have
 * to retype the key. The placeholder says so.
 */
export function SettingsSection({
  namespace,
  title,
  description,
  fields,
  toggle,
}: {
  namespace: Namespace
  title: string
  description?: string
  fields: Field[]
  toggle?: { key: string; label: string; value: boolean }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(toggle?.value ?? false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="text-lg text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-muted mt-1">{description}</p>}
      </div>

      <form
        className="space-y-5"
        action={(formData) => {
          setMessage(null)

          const values: Record<string, string> = {}
          for (const field of fields) {
            values[field.key] = String(formData.get(field.key) ?? '')
          }
          if (toggle) values[toggle.key] = enabled ? '1' : '0'

          startTransition(async () => {
            const result = await saveSettingsAction(namespace, values)
            setMessage(
              result.ok
                ? { tone: 'ok', text: 'تغییرات ذخیره شد.' }
                : { tone: 'error', text: result.error },
            )
            if (result.ok) router.refresh()
          })
        }}
      >
        {toggle && (
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="accent-[var(--color-accent)] w-4 h-4"
            />
            <span className="text-sm text-ink">{toggle.label}</span>
          </label>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          {fields.map((field) => (
            <div key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
              <label htmlFor={`${namespace}-${field.key}`} className="label">
                {field.label}
              </label>

              {field.multiline ? (
                <textarea
                  id={`${namespace}-${field.key}`}
                  name={field.key}
                  defaultValue={field.value}
                  dir={field.dir}
                  rows={4}
                  className="field resize-y text-sm"
                />
              ) : (
                <input
                  id={`${namespace}-${field.key}`}
                  name={field.key}
                  type={field.secret ? 'password' : 'text'}
                  defaultValue={field.secret ? '' : field.value}
                  dir={field.dir}
                  autoComplete={field.secret ? 'off' : undefined}
                  className={`field ${field.dir === 'ltr' ? 'nums' : ''}`}
                  placeholder={
                    field.secret
                      ? field.isSet
                        ? '•••••••• (برای تغییر، مقدار جدید را وارد کنید)'
                        : 'وارد نشده'
                      : undefined
                  }
                />
              )}

              {field.hint && <p className="hint">{field.hint}</p>}
              {field.secret && field.isSet && (
                <p className="hint">خالی بگذارید تا مقدار فعلی حفظ شود.</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? 'در حال ذخیره…' : 'ذخیره'}
          </button>

          {message && (
            <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
