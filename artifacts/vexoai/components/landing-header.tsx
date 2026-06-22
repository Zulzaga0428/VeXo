"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { translations, type Locale } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import { createClient } from "@/lib/supabase/client"

export function LandingHeader({
  locale: localeProp,
  onLocaleChange,
}: {
  locale?: Locale
  onLocaleChange?: (l: Locale) => void
}) {
  const [internalLocale, setInternalLocale] = useState<Locale>("mn")
  const locale = localeProp ?? internalLocale
  const setLocale = onLocaleChange ?? setInternalLocale
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const t = translations[locale]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user))
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-lg sm:text-xl font-bold tracking-tight">VexoAi</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.features}
          </Link>
          <Link href="/gallery" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {locale === "mn" ? "Галерей" : "Gallery"}
          </Link>
          <Link href="/prompts" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {locale === "mn" ? "Free Prompt" : "Free Prompt"}
          </Link>
          <Link href="/#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.pricing}
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher locale={locale} onLocaleChange={setLocale} />
          {isLoggedIn ? (
            <Link href="/app/dashboard">
              <Button size="sm" className="hidden sm:flex bg-accent text-accent-foreground hover:bg-accent/90">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden text-muted-foreground lg:flex">
                  {t.nav.signIn}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="hidden sm:flex bg-accent text-accent-foreground hover:bg-accent/90">
                  {t.nav.getStarted}
                </Button>
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col px-4 py-4 gap-4">
            <Link href="/#features" className="text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>
              {t.nav.features}
            </Link>
            <Link href="/gallery" className="text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>
              {locale === "mn" ? "Галерей" : "Gallery"}
            </Link>
            <Link href="/prompts" className="text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>
              Free Prompt
            </Link>
            <Link href="/#pricing" className="text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>
              {t.nav.pricing}
            </Link>
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              {isLoggedIn ? (
                <Link href="/app/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                      {t.nav.signIn}
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                      {t.nav.getStarted}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
