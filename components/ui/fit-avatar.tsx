'use client'

import { isDefaultAvatarUrl } from '@/lib/avatar-utils'
import { UserCircle } from 'lucide-react'

interface FitAvatarProps {
  src?: string | null
  alt?: string
  /** Pixel size of the container circle */
  size?: number
  /** Tailwind border-color class */
  borderColor?: string
  /** Tailwind border-width class */
  borderWidth?: string
  /** Tailwind bg color for the circle backdrop */
  bgColor?: string
  /** How much default avatars scale beyond the circle. 1 = flush, 1.3 = 30% bigger */
  overflowScale?: number
  /** Extra classes on the background circle element */
  circleClassName?: string
  /** Fallback content when no src is provided */
  fallback?: React.ReactNode
  /** Extra className on the root wrapper */
  className?: string
}

/**
 * Reusable avatar component that handles:
 * - Default avatars: Scaled up to overflow the circle 
 * - Custom photos: Normal circular crop
 * - No photo: Fallback icon
 */
export function FitAvatar({
  src,
  alt = 'Avatar',
  size = 64,
  borderColor = 'border-white',
  borderWidth = 'border-2',
  bgColor = 'bg-primary',
  overflowScale = 6.0,
  circleClassName = '',
  fallback,
  className = '',
}: FitAvatarProps) {
  const isDefault = src ? isDefaultAvatarUrl(src) : false

  /* ── No source → fallback ───────────────────────────────────── */
  if (!src) {
    return (
      <div
        className={`rounded-full ${bgColor} ${borderWidth} ${borderColor} flex items-center justify-center flex-shrink-0 ${circleClassName} ${className}`}
        style={{ width: size, height: size }}
      >
        {fallback || (
          <UserCircle
            style={{ width: size * 0.65, height: size * 0.65 }}
            className="text-white/60"
          />
        )}
      </div>
    )
  }

  /* ── Default avatar → overflow ──────────────────────────────── */
  if (isDefault) {
    const imgSize = size * overflowScale

    return (
      <div
        className={`relative flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Visible circle background */}
        <div
          className={`absolute inset-0 rounded-full ${bgColor} ${borderWidth} ${borderColor} ${circleClassName}`}
        />
        {/* Oversized image that breaks out of the circle */}
        <img
          src={src}
          alt={alt}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none select-none transition-transform z-10"
          style={{
            width: imgSize,
            height: imgSize,
          }}
          draggable={false}
        />
      </div>
    )
  }

  /* ── Custom photo → normal clipped circle ───────────────────── */
  return (
    <div
      className={`rounded-full overflow-hidden ${bgColor} ${borderWidth} ${borderColor} flex-shrink-0 ${circleClassName} ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  )
}
