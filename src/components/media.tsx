import { mediaUrl } from '@/lib/media-url'
import { OrchidSpray } from './ornament'

export function ImagePlaceholder({
  width,
  height,
  seed = 0,
  className,
  label,
}: {
  width: number
  height: number
  seed?: number
  className?: string
  label?: string
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-sunken ${className ?? ''}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-accent-3 via-bg-secondary to-surface-sunken"
        aria-hidden="true"
      />
      <OrchidSpray
        seed={seed}
        className="absolute -bottom-[12%] -start-[10%] h-[95%] w-[95%] text-accent/[0.22]"
      />
      <OrchidSpray
        seed={seed + 1}
        className="absolute -end-[18%] -top-[14%] h-[62%] w-[62%] rotate-180 text-accent/[0.13]"
      />
      {label && (
        <span className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-ink-muted/80">
          {label}
        </span>
      )}
    </div>
  )
}

interface ResponsiveImageProps {
  path: string | null
  alt: string
  width: number
  height: number
  sizes: string
  priority?: boolean
  className?: string
  style?: React.CSSProperties
  seed?: number
}

export function ResponsiveImage({
  path,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className,
  style,
  seed = 0,
}: ResponsiveImageProps) {
  if (!path) {
    return (
      <ImagePlaceholder width={width} height={height} seed={seed} className={className} />
    )
  }

  return (
    <img
      src={mediaUrl(path)}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      className={className}
      style={style}
    />
  )
}

export function StaticImage({
  path,
  alt,
  width,
  height,
  className,
  priority = false,
}: {
  path: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}) {
  const src = path.startsWith('/') ? path : mediaUrl(path)

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
    />
  )
}
