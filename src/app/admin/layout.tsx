import '../globals.css'

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
