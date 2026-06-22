"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { Locale } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export function LegalPageLayout({
  title,
  children,
  locale: initialLocale,
}: {
  title: { mn: string; en: string }
  children: (locale: Locale) => React.ReactNode
  locale?: Locale
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? "mn")

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? window.localStorage.getItem("locale") : null) as Locale | null
    if (stored === "mn" || stored === "en") setLocale(stored)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="text-base sm:text-lg font-bold">VexoAi</span>
          </Link>
          <LanguageSwitcher locale={locale} onLocaleChange={setLocale} />
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {locale === "mn" ? "Нүүр хуудас руу буцах" : "Back to home"}
          </Link>
          <h1 className="mt-4 text-balance text-3xl sm:text-4xl font-bold tracking-tight">
            {title[locale]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {locale === "mn" ? "Сүүлд шинэчилсэн: 2026 оны 5-р сар" : "Last updated: May 2026"}
          </p>
        </div>

        <article className="prose prose-invert max-w-none text-pretty leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-4 [&_p]:text-sm [&_p]:text-muted-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted-foreground [&_li]:mb-1 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">
          {children(locale)}
        </article>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col gap-3 sm:flex-row items-center justify-between text-xs sm:text-sm text-muted-foreground">
          <p>{locale === "mn" ? "© 2026 VexoAi• Бүх эрх хуулиар хамгаалагдсан." : "© 2026 VexoAi• All rights reserved."}</p>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/privacy" className="hover:text-foreground">{locale === "mn" ? "Нууцлал" : "Privacy"}</Link>
            <Link href="/terms" className="hover:text-foreground">{locale === "mn" ? "Нөхцөл" : "Terms"}</Link>
            <Link href="/contact" className="hover:text-foreground">{locale === "mn" ? "Холбоо барих" : "Contact"}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
