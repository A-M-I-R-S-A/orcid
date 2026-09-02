import '../globals.css'

/**
 * Admin root layout.
 *
 * Separate from the storefront layout: no header, no footer, and `noindex,
 * nofollow` on every page. robots.txt also disallows /admin, but a robots
 * directive is a request and a meta tag is another layer — neither is a
 * substitute for the authentication that actually protects it.
 *
 * The admin panel is Persian and RTL like the storefront (§3), but does NOT
 * inherit the customer-editable theme: an administrator experimenting with a
 * pale accent must not be able to make the panel unreadable and lock
 * themselves out of the screen where they would fix it.
 */
export const metadata = {
  title: { default: 'مدیریت ارکید', template: '%s | مدیریت ارکید' },
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      className="min-h-[100dvh]"
      style={
        {
          // A fixed, deliberately quiet palette, independent of the storefront
          // theme tokens. Warm neutrals so it still feels like Orchid.
          '--c-bg': '#F6F3EF',
          '--c-surface': '#FFFFFF',
          '--c-surface-raised': '#FFFFFF',
          '--c-surface-sunken': '#EFEAE3',
          '--c-text': '#2F2018',
          '--c-text-muted': '#6B584C',
          '--c-text-subtle': '#958375',
          '--c-accent': '#4A171E',
          '--c-accent-2': '#A15530',
          '--c-accent-3': '#C4A79A',
          '--c-border': '#E2D9CE',
          '--c-border-strong': '#CBBCAC',
          '--c-btn-bg': '#4A171E',
          '--c-btn-text': '#FFFFFF',
          '--c-btn-hover': '#3A1218',
          '--c-success': '#3F6B4A',
          '--c-success-bg': '#E3EDE4',
          '--c-warning': '#8A5F16',
          '--c-warning-bg': '#F5EAD3',
          '--c-danger': '#8C2F39',
          '--c-danger-bg': '#F5E2E1',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
