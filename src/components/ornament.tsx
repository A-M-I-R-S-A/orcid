export function OrchidBloom({ className, opacity = 1 }: { className?: string; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      aria-hidden="true"
    >
      <path d="M50 46c-6-10-4-22 3-27 7-5 15 0 15 9 0 8-9 15-18 18z" />
      <path d="M50 46c6-10 4-22-3-27-7-5-15 0-15 9 0 8 9 15 18 18z" />
      <path d="M50 50c-12-4-24 1-27 9-3 8 4 14 12 12 8-2 14-12 15-21z" />
      <path d="M50 50c12-4 24 1 27 9 3 8-4 14-12 12-8-2-14-12-15-21z" />
      <path d="M50 52c-7 3-11 11-9 18 2 7 9 10 14 6 5-4 5-16-5-24z" />
      <circle cx="50" cy="49" r="3.2" />
    </svg>
  )
}

export function OrchidSpray({ className, seed = 0 }: { className?: string; seed?: number }) {
  const variant = Math.abs(seed) % 3

  const stems = [
    'M20 78C34 70 44 56 52 40c5-10 12-18 22-24',
    'M18 82C36 76 50 62 58 44c4-9 10-16 20-21',
    'M22 74C32 64 40 52 46 38c5-11 14-19 26-23',
  ]

  const blooms: [number, number, number][][] = [
    [
      [52, 40, 30],
      [36, 58, 22],
      [66, 26, 17],
    ],
    [
      [58, 44, 27],
      [40, 62, 20],
      [72, 28, 15],
    ],
    [
      [46, 38, 31],
      [30, 56, 20],
      [64, 22, 18],
    ],
  ]

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path
        d={stems[variant]}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="78" cy="18" r="2.4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="84" cy="26" r="1.8" stroke="currentColor" strokeWidth="1" opacity="0.4" />

      {blooms[variant]!.map(([x, y, size], i) => (
        <g key={i} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
          <OrchidBloom opacity={0.75 - i * 0.15} />
        </g>
      ))}
    </svg>
  )
}

export function Divider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className ?? ''}`} aria-hidden="true">
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-line to-transparent" />
      <OrchidBloom className="w-4 h-4 text-accent-3 shrink-0" />
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
    </div>
  )
}
