'use client'

import { isDefaultAvatarUrl } from '@/lib/avatar-utils'
import { UserCircle } from 'lucide-react'

interface FitAvatarProps {
  src?: string | null
  alt?: string
  size?: number
  borderColor?: string
  borderWidth?: string
  bgColor?: string
  overflowScale?: number
  circleClassName?: string
  fallback?: React.ReactNode
  className?: string
  isPremium?: boolean
}

/**
 * Reusable avatar component that handles:
 * - Default avatars: Scaled up to overflow the circle
 * - Custom photos: Normal circular crop
 * - No photo: Fallback icon
 * - Premium users: Animated gradient border (red/white/blue)
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
  isPremium = false,
}: FitAvatarProps) {
  const isDefault = src ? isDefaultAvatarUrl(src) : false
  const effectiveBgColor = isPremium && bgColor === 'bg-primary' ? 'bg-[#1e40af]' : bgColor

  const renderContent = () => {
    /* ── No source → fallback ───────────────────────────────────── */
    if (!src) {
      return (
        <div
          className={`rounded-full ${effectiveBgColor} ${borderWidth} ${borderColor} flex items-center justify-center flex-shrink-0 ${circleClassName}`}
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
      // Extremely large scales to satisfy the "WOW" requirement
      const dynamicScale = isPremium ? 1.80 : 1.75
      const imgSize = size * dynamicScale

      return (
        <div
          className="relative flex-shrink-0"
          style={{ width: size, height: size }}
        >
          {/* Visible circle background */}
          <div
            className={`absolute inset-0 rounded-full ${effectiveBgColor} ${borderWidth} ${borderColor} ${circleClassName}`}
          />
          {/* Oversized image - Centered perfectly with absolute positioning */}
          <img
            src={src}
            alt={alt}
            className="absolute pointer-events-none select-none transition-transform z-20 hover:scale-110"
            style={{
              width: imgSize,
              height: imgSize,
              maxWidth: 'none',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              objectFit: 'contain'
            }}
            draggable={false}
          />
        </div>
      )
    }


    /* ── Custom photo → normal clipped circle ───────────────────── */
    return (
      <div
        className={`rounded-full overflow-hidden ${effectiveBgColor} ${borderWidth} ${borderColor} flex-shrink-0 ${circleClassName}`}
        style={{ width: size, height: size }}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (isPremium) {
    const wrapperSize = size + 8
    return (
      <div className={`relative flex-shrink-0 ${className}`} style={{ width: wrapperSize, height: wrapperSize }}>
        {/* Animated Gradient Border */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(45deg, #ef4444, #ffffff, #3b82f6, #ef4444, #ffffff, #3b82f6)',
            backgroundSize: '400% 400%',
            animation: 'premium-gradient-spin 3s linear infinite',
            boxShadow: '0 0 12px rgba(220,38,38,0.4), 0 0 24px rgba(59,130,246,0.3)',
          }}
        />
        {/* Inner dark ring for comic effect */}
        <div className="absolute inset-[2px] rounded-full bg-[#1a1a2e]" />
        {/* Avatar content */}
        <div className="absolute inset-[4px] z-10 flex items-center justify-center">
          {renderContent()}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-shrink-0 ${className}`}>
      {renderContent()}
    </div>
  )
}
