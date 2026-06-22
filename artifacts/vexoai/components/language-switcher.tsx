"use client"

import { type Locale } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

interface LanguageSwitcherProps {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function LanguageSwitcher({ locale, onLocaleChange }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onLocaleChange("en")}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          locale === "en"
            ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onLocaleChange("mn")}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          locale === "mn"
            ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        MN
      </Button>
    </div>
  )
}
