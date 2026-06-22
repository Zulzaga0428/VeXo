"use client"

import Image from "next/image"

const FLAG_CODES: Record<string, string> = {
  mn: "mn",
  en: "gb",
  zh: "cn",
  ru: "ru",
  ko: "kr",
  ja: "jp",
  es: "es",
}

interface Props {
  language: string
  size?: number
  ring?: boolean
  glow?: boolean
  className?: string
}

/**
 * Circular SVG flag badge using flagcdn.com.
 * Falls back to a neutral globe gradient if language is unknown.
 */
export function FlagBadge({ language, size = 22, ring = true, glow = false, className = "" }: Props) {
  const code = FLAG_CODES[language]
  const dim = size

  if (!code) {
    return (
      <span
        className={`inline-block rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 ${className}`}
        style={{ width: dim, height: dim }}
        aria-hidden
      />
    )
  }

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${
        ring ? "ring-1 ring-white/15" : ""
      } ${glow ? "shadow-[0_0_12px_rgba(255,255,255,0.18)]" : "shadow-[0_1px_3px_rgba(0,0,0,0.4)]"} ${className}`}
      style={{ width: dim, height: dim }}
    >
      <Image
        src={`https://flagcdn.com/w80/${code}.png`}
        alt={`${language} flag`}
        width={dim * 2}
        height={dim * 2}
        unoptimized
        className="h-full w-full object-cover"
      />
    </span>
  )
}
