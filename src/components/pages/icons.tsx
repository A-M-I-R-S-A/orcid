export type IconName =
  | 'phone'
  | 'mail'
  | 'pin'
  | 'clock'
  | 'instagram'
  | 'telegram'
  | 'whatsapp'
  | 'truck'
  | 'refresh'
  | 'ruler'
  | 'shield'
  | 'sparkle'
  | 'heart'
  | 'question'
  | 'package'

const PATHS: Record<IconName, React.ReactNode> = {
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 006.1 6.1l1.4-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.7a2 2 0 012-2.2z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7.5l7.1 5a1.6 1.6 0 001.8 0l7.1-5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s7-6.2 7-11.5a7 7 0 10-14 0c0 5.3 7 11.5 7 11.5z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  telegram: (
    <>
      <path d="M21 4.5L2.8 11.3c-.7.3-.7 1.2 0 1.4l4.6 1.5 1.7 5c.2.6 1 .8 1.4.3l2.5-2.6 4.5 3.3c.6.4 1.3.1 1.5-.6L21.9 5.6c.2-.8-.5-1.4-1.2-1.1z" />
      <path d="M7.4 14.2L18.6 6.9l-8.1 8.4-.4 4" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M3.5 20.5l1.3-4.4A8 8 0 1112 20a8 8 0 01-4-1.1l-4.5 1.6z" />
      <path d="M9 9c0 3 2.4 5.4 5.3 5.6.6 0 1.2-.4 1.3-1l.1-.7-2-.9-.8.9c-1-.4-1.8-1.2-2.2-2.2l.9-.8-.9-2-.7.1c-.6.1-1 .6-1 1.2z" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 7.5h10v9h-10z" />
      <path d="M12.5 11h4l3 3v2.5h-7z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="16.5" cy="18" r="1.8" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6" />
      <path d="M17.5 3v3.6h-3.6M6.5 21v-3.6h3.6" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M7 8v3.2M11 8v4.4M15 8v3.2M19 8v4.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8l7 2.6v5.4c0 4.5-3 8.1-7 10.4-4-2.3-7-5.9-7-10.4V5.4z" />
      <path d="M9 12l2.2 2.2L15.4 10" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-9.6A4 4 0 0112 7.6a4 4 0 017.5 2.8c0 5-7.5 9.6-7.5 9.6z" />,
  question: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 114 2.3c-.9.6-1.6 1-1.6 2.1" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  package: (
    <>
      <path d="M12 2.9l8 4.2v9.8l-8 4.2-8-4.2V7.1z" />
      <path d="M4.3 7.2L12 11.3l7.7-4.1M12 11.3V21" />
    </>
  ),
}

export function Icon({
  name,
  className,
  strokeWidth = 1.4,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
