import { OrchidSpray } from '@/components/ornament'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden">
      <OrchidSpray
        seed={3}
        className="pointer-events-none absolute -start-32 -top-24 hidden h-[28rem] w-[28rem] text-accent/[0.06] md:block"
        aria-hidden="true"
      />
      <OrchidSpray
        seed={5}
        className="pointer-events-none absolute -bottom-32 -end-28 hidden h-[24rem] w-[24rem] rotate-180 text-accent/[0.05] md:block"
        aria-hidden="true"
      />

      <div className="container-page relative py-14 md:py-24">
        <div className="mx-auto max-w-[26rem]">
          <div className="mb-8 text-center">
            <h1 className="section-title">{title}</h1>
            <p className="mt-3 leading-relaxed text-ink-muted">{subtitle}</p>
          </div>

          <div className="card card-raised p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
