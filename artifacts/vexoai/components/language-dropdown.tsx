"use client"

import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import type { Locale } from "@/lib/i18n"

// Single source for the languages the switcher offers. We use real flag images
// (flagcdn) instead of emoji so the flag renders consistently on every device.
const LANGUAGES: { code: Locale; cc: string; label: string }[] = [
  { code: "mn", cc: "mn", label: "Монгол" },
  { code: "en", cc: "us", label: "English" },
]

function Flag({ cc, className = "" }: { cc: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt=""
      draggable={false}
      className={`object-cover ${className}`}
    />
  )
}

export function LanguageDropdown({
  locale,
  onChange,
}: {
  locale: Locale
  onChange: (locale: Locale) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0]

  return (
    <div ref={ref} className="relative">
      {/* Compact circular flag-only trigger. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Хэл солих"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur transition-colors hover:border-accent/60"
      >
        <Flag cc={current.cc} className="h-4 w-4 rounded-full ring-1 ring-border/50" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card/95 p-1 shadow-xl backdrop-blur"
        >
          {LANGUAGES.map((lang) => {
            const selected = lang.code === locale
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(lang.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "bg-accent/15 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Flag cc={lang.cc} className="h-4 w-6 rounded-sm" />
                <span className="flex-1 text-left">{lang.label}</span>
                {selected && <Check className="h-4 w-4 text-accent" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
