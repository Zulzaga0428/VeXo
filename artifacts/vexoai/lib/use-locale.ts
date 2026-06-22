"use client"

import { useEffect, useState, useCallback } from "react"
import type { Locale } from "@/lib/i18n"

const STORAGE_KEY = "vexo-locale"

// Lightweight client-side locale persistence shared across pages.
// Reads/writes localStorage and syncs other open tabs/components via a custom event.
export function useLocale(defaultLocale: Locale = "mn") {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  // Load the saved locale on mount (client only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "mn" || saved === "en") setLocaleState(saved)
    } catch {
      // ignore
    }
    // Keep this component in sync if another part of the app changes the locale.
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Locale>).detail
      if (next === "mn" || next === "en") setLocaleState(next)
    }
    window.addEventListener("vexo:locale", onChange as EventListener)
    return () => window.removeEventListener("vexo:locale", onChange as EventListener)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent<Locale>("vexo:locale", { detail: next }))
  }, [])

  return { locale, setLocale }
}
