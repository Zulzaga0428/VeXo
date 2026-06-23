"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { ArrowRight, Compass } from "lucide-react"
import { useLocale } from "@/lib/use-locale"
import { LanguageDropdown } from "@/components/language-dropdown"
import { HeroIdeaAnimation } from "@/components/hero-idea-animation"

type Category = {
  id: string
  titleMn: string
  titleEn: string
  descMn: string
  descEn: string
  cover: string
  prompt: string
}

const CATEGORIES: Category[] = [
  {
    id: "product",
    titleMn: "Бүтээгдэхүүн",
    titleEn: "Product",
    descMn: "Барааны танилцуулга реклам",
    descEn: "Product showcase ads",
    cover: "/dashboard/cat-product.png",
    prompt: "Бүтээгдэхүүний 3 хэсэгтэй реклам видео хийх",
  },
  {
    id: "food",
    titleMn: "Хоол хүнс",
    titleEn: "Food",
    descMn: "Ресторан, хоолны реклам",
    descEn: "Restaurant & food ads",
    cover: "/dashboard/cat-food.png",
    prompt: "Хоол хүнсний амтат 3 хэсэгтэй реклам видео хийх",
  },
  {
    id: "fashion",
    titleMn: "Загвар",
    titleEn: "Fashion",
    descMn: "Хувцас, загварын реклам",
    descEn: "Clothing & fashion ads",
    cover: "/dashboard/cat-fashion.png",
    prompt: "Загвар хувцасны 3 хэсэгтэй реклам видео хийх",
  },
  {
    id: "beauty",
    titleMn: "Гоо сайхан",
    titleEn: "Beauty",
    descMn: "Косметик, арьс арчилгаа",
    descEn: "Cosmetics & skincare",
    cover: "/dashboard/cat-beauty.png",
    prompt: "Гоо сайхны бүтээгдэхүүний 3 хэсэгтэй реклам видео хийх",
  },
  {
    id: "realestate",
    titleMn: "Үл хөдлөх",
    titleEn: "Real Estate",
    descMn: "Байр, орон сууцны реклам",
    descEn: "Property & real estate",
    cover: "/dashboard/cat-realestate.png",
    prompt: "Үл хөдлөх хөрөнгийн 3 хэсэгтэй реклам видео хийх",
  },
  {
    id: "tech",
    titleMn: "Технологи",
    titleEn: "Technology",
    descMn: "Гаджет, апп, технологи",
    descEn: "Gadgets, apps, tech",
    cover: "/dashboard/cat-tech.png",
    prompt: "Технологийн бүтээгдэхүүний 3 хэсэгтэй реклам видео хийх",
  },
]

export function DashboardHome({
  locale: initialLocale = "mn",
  footer,
}: {
  locale?: "mn" | "en"
  // Optional footer rendered at the bottom of the scrolling area (landing only).
  footer?: React.ReactNode
}) {
  const { locale, setLocale } = useLocale(initialLocale)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [idea, setIdea] = useState("")
  const router = useRouter()

  const go = (prompt: string) => {
    const q = prompt.trim()
    if (q) {
      router.push(`/app/create?idea=${encodeURIComponent(q)}`)
    } else {
      router.push("/app/create")
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    go(idea)
  }

  // Rotating word in the hero headline for a lively, animated feel.
  const rotatingWords =
    locale === "mn"
      ? ["реклам", "контент", "танилцуулга", "брэнд", "promo"]
      : ["ad", "content", "promo", "brand", "story"]
  const [wordIndex, setWordIndex] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out, swap the word, then fade back in.
      setWordVisible(false)
      const t = setTimeout(() => {
        setWordIndex((i) => (i + 1) % rotatingWords.length)
        setWordVisible(true)
      }, 350)
      return () => clearTimeout(t)
    }, 2200)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar locale={locale} onCollapsedChange={setSidebarCollapsed} />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? "md:ml-16" : "md:ml-56"}`}>
        {/* Top bar with language switcher + Gallery shortcut, pinned to the very top */}
        <div className="absolute right-3 top-3 z-30 flex items-center gap-2 sm:right-6 sm:top-4">
          <LanguageDropdown locale={locale} onChange={setLocale} />
          <Link
            href="/gallery"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur transition-colors hover:border-accent/50 hover:text-foreground"
          >
            <Compass className="h-4 w-4" />
            {locale === "mn" ? "Галерей" : "Gallery"}
          </Link>
        </div>

        {/* Centered hero with the big agent chat box */}
        <div className="relative flex min-h-[78vh] flex-col items-center justify-start px-4 sm:px-6 pt-24 sm:pt-32 pb-12">
          {/* Soft glow behind the chat box */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/3 h-[360px] w-[680px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]"
          />

          <div className="relative w-full max-w-3xl text-center">
            <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {locale === "mn" ? (
                <>
                  Ямар{" "}
                  <span
                    className={`inline-block bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent transition-all duration-300 ${
                      wordVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    }`}
                  >
                    {rotatingWords[wordIndex]}
                  </span>{" "}
                  видео хиймээр байна?
                </>
              ) : (
                <>
                  What{" "}
                  <span
                    className={`inline-block bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent transition-all duration-300 ${
                      wordVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    }`}
                  >
                    {rotatingWords[wordIndex]}
                  </span>{" "}
                  do you want to create?
                </>
              )}
            </h1>
            <HeroIdeaAnimation />

            {/* Big, wide agent chat box */}
            <form onSubmit={onSubmit} className="glow-border mx-auto mt-8 w-full">
              <div className="relative z-10 rounded-3xl border border-border bg-card/80 p-2.5 shadow-2xl shadow-black/40 backdrop-blur transition-colors focus-within:border-accent/60">
                <div className="px-3 pt-3">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        go(idea)
                      }
                    }}
                    rows={2}
                    placeholder={
                      locale === "mn"
                        ? "Жишээ: Шинэ кофе шопын 3 хэсэгтэй реклам видео хий..."
                        : "e.g. A 3-scene ad for my new coffee shop..."
                    }
                    className="min-h-[56px] w-full resize-none bg-transparent text-left text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
                  <span className="text-xs text-muted-foreground">
                    {locale === "mn" ? "Enter дарж эхлүүлнэ" : "Press Enter to start"}
                  </span>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                  >
                    {locale === "mn" ? "Эхлэх" : "Start"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Quick example chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.slice(0, 4).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => go(cat.prompt)}
                  className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  {locale === "mn" ? cat.titleMn : cat.titleEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-16">
          {/* Category cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href="/prompts"
                className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={cat.cover || "/placeholder.svg"}
                    alt={locale === "mn" ? cat.titleMn : cat.titleEn}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{locale === "mn" ? cat.titleMn : cat.titleEn}</h3>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {locale === "mn" ? cat.descMn : cat.descEn}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {footer}
      </div>
    </div>
  )
}
