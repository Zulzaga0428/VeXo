"use client"

import Link from "next/link"

export function SiteFooter({ locale = "mn" }: { locale?: "mn" | "en" }) {
  return (
    <footer className="border-t border-border py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:gap-6 md:flex-row">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-base sm:text-lg font-bold">VexoAi</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {locale === "mn"
                ? "© 2026 VexoAi• Бүх эрх хуулиар хамгаалагдсан."
                : "© 2026 VexoAi• All rights reserved."}
            </p>
            <Link
              href="https://veio.digital/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Built by VEIO•
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              {locale === "mn" ? "Нууцлал" : "Privacy"}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {locale === "mn" ? "Нөхцөл" : "Terms"}
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              {locale === "mn" ? "Холбоо барих" : "Contact"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
