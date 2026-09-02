import { buildSrcSet, jpegFallbackUrl, mediaUrl } from '@/lib/media-url'
import { OrchidSpray } from './ornament'

/**
 * Product imagery.
 *
 * A hand-built <picture> rather than next/image, deliberately: derivatives are
 * already generated at upload time, so routing every request through Next's
 * optimiser would re-do work we have done and put sharp on the request path of
 * a shared host. This emits the pre-built AVIF/WebP/JPEG set directly.
 *
 * `priority` controls the LCP behaviour §72 asks about — the first product
 * image and the hero are eager and high-priority; everything else is lazy.
 */

/**
 * Shown wherever a product has no photograph yet.
 *
 * Deliberately not a grey box captioned "no image": that reads as a broken
 * page. A tinted botanical panel reads as a considered placeholder, which is
 * what it is — the shop's own photography simply has not been uploaded yet.
 * `seed` keeps a given product's arrangement stable across renders so a grid
 * does not reshuffle between loads.
 */
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
      {/*
        Diagonal wash so the panel has depth and a light direction rather than
        reading as one flat fill. Deliberately weighted toward the secondary
        and tertiary tints: at the previous strength the panel sat within a few
        percent of the page background, so a whole row of them read as blank
        space rather than as tiles awaiting photography.
      */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-bg-secondary via-surface-sunken to-accent-3/70"
        aria-hidden="true"
      />
      {/* Bled off the corner rather than centred — a motif that runs off the
          edge reads as printed stock; one centred in the box reads as clip art. */}
      <OrchidSpray
        seed={seed}
        className="absolute -bottom-[12%] -start-[10%] h-[95%] w-[95%] text-accent/[0.22]"
      />
      <OrchidSpray
        seed={seed + 1}
        className="absolute -end-[18%] -top-[14%] h-[62%] w-[62%] rotate-180 text-accent/[0.13]"
      />
      {label && (
        // No tracking: Persian is a joined script and letter-spacing pulls the
        // word apart. `uppercase` is a no-op on it either way.
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
  /** Tells the browser how wide this will actually render. Required. */
  sizes: string
  priority?: boolean
  className?: string
  /** Keeps the placeholder arrangement stable for a given product. */
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
  seed = 0,
}: ResponsiveImageProps) {
  if (!path) {
    return <ImagePlaceholder width={width} height={height} seed={seed} className={className} />
  }

  return (
    <picture>
      <source type="image/avif" srcSet={buildSrcSet(path, width, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={buildSrcSet(path, width, 'webp')} sizes={sizes} />
      <img
        src={jpegFallbackUrl(path)}
        alt={alt}
        // Explicit dimensions reserve the space before the bytes arrive, which
        // is most of what keeps CLS at zero. §73.
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={className}
      />
    </picture>
  )
}

/** Plain single-size image, for logos and icons where a srcset is overkill. */
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
