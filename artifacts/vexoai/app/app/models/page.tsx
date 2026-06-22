"use client"

import { useState } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  Film,
  ImageIcon,
  Mic,
  Brain,
  Check,
  Zap,
  Clock,
  DollarSign,
  Star,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ModelCategory = "video" | "image" | "voice" | "llm"

interface AIModel {
  id: string
  name: string
  provider: string
  category: ModelCategory
  description: string
  descriptionMn: string
  speed: "fast" | "medium" | "slow"
  quality: "standard" | "high" | "ultra"
  cost: "low" | "medium" | "high"
  isDefault?: boolean
  isNew?: boolean
  isPro?: boolean
}

const models: AIModel[] = [
  // Video Models
  {
    id: "kling-standard",
    name: "Vexo 2.0",
    provider: "VexoAi",
    category: "video",
    description: "Fast video with audio, 5-10 sec clips",
    descriptionMn: "Хурдан, дуутай видео, 5-10 сек",
    speed: "fast",
    quality: "high",
    cost: "medium",
    isDefault: true,
  },
  {
    id: "kling-pro",
    name: "Vexo 2.5",
    provider: "VexoAi",
    category: "video",
    description: "Business-grade, higher quality, with audio",
    descriptionMn: "Бизнес түвшний, өндөр чанар, дуутай",
    speed: "medium",
    quality: "ultra",
    cost: "high",
    isPro: true,
  },
  {
    id: "luma-dream",
    name: "Vexo 3.0",
    provider: "VexoAi",
    category: "video",
    description: "Premium cinematic video with audio",
    descriptionMn: "Премиум, кино төст, дуутай видео",
    speed: "medium",
    quality: "ultra",
    cost: "high",
    isNew: true,
  },
  {
    id: "runway-gen3",
    name: "Vexo 3.5",
    provider: "VexoAi",
    category: "video",
    description: "Top quality, native audio",
    descriptionMn: "Хамгийн өндөр чанар, дуутай",
    speed: "slow",
    quality: "ultra",
    cost: "high",
    isPro: true,
  },
  // Image Models
  {
    id: "flux-schnell",
    name: "Vexo Image Fast",
    provider: "VexoAi",
    category: "image",
    description: "Ultra-fast image generation",
    descriptionMn: "Маш хурдан зураг үүсгэгч",
    speed: "fast",
    quality: "high",
    cost: "low",
    isDefault: true,
  },
  {
    id: "flux-dev",
    name: "Vexo Image HD",
    provider: "VexoAi",
    category: "image",
    description: "High quality, detailed images",
    descriptionMn: "Өндөр чанар, нарийн дэлгэрэнгүй",
    speed: "medium",
    quality: "ultra",
    cost: "medium",
  },
  {
    id: "flux-pro",
    name: "Vexo Image Pro",
    provider: "VexoAi",
    category: "image",
    description: "Best quality image generation",
    descriptionMn: "Хамгийн сайн чанарын зураг",
    speed: "medium",
    quality: "ultra",
    cost: "high",
    isPro: true,
  },
  {
    id: "stable-diffusion-xl",
    name: "Vexo Image Classic",
    provider: "VexoAi",
    category: "image",
    description: "Classic engine with great results",
    descriptionMn: "Сонгодог хөдөлгүүр, сайн үр дүн",
    speed: "medium",
    quality: "high",
    cost: "low",
  },
  {
    id: "recraft-v3",
    name: "Vexo Image Vector",
    provider: "VexoAi",
    category: "image",
    description: "Vector & design-focused AI",
    descriptionMn: "Вектор, дизайнд зориулсан",
    speed: "medium",
    quality: "high",
    cost: "medium",
    isNew: true,
  },
  // Voice Models
  {
    id: "camb-mars-pro",
    name: "Vexo Voice Pro",
    provider: "VexoAi",
    category: "voice",
    description: "Studio-quality Mongolian voices",
    descriptionMn: "Студио чанарын монгол хоолой",
    speed: "medium",
    quality: "ultra",
    cost: "medium",
    isDefault: true,
  },
  {
    id: "gemini-tts",
    name: "Vexo Voice Global",
    provider: "VexoAi",
    category: "voice",
    description: "Realistic multilingual voices",
    descriptionMn: "Бодит олон хэлний дуу",
    speed: "fast",
    quality: "high",
    cost: "low",
  },
  // LLM Models
  {
    id: "claude-sonnet",
    name: "Vexo Brain Pro",
    provider: "VexoAi",
    category: "llm",
    description: "Best for creative prompts",
    descriptionMn: "Бүтээлч промпт үүсгэхэд",
    speed: "fast",
    quality: "ultra",
    cost: "medium",
    isDefault: true,
  },
  {
    id: "gpt-4o",
    name: "Vexo Brain Fast",
    provider: "VexoAi",
    category: "llm",
    description: "Versatile, fast responses",
    descriptionMn: "Олон талт, хурдан хариу",
    speed: "fast",
    quality: "ultra",
    cost: "medium",
  },
  {
    id: "gemini-pro",
    name: "Vexo Brain Long",
    provider: "VexoAi",
    category: "llm",
    description: "Great for long content",
    descriptionMn: "Урт контентод тохиромжтой",
    speed: "fast",
    quality: "high",
    cost: "low",
  },
]

const categories = [
  { id: "video" as const, icon: Film, labelMn: "Видео", labelEn: "Video" },
  { id: "image" as const, icon: ImageIcon, labelMn: "Зураг", labelEn: "Image" },
  { id: "voice" as const, icon: Mic, labelMn: "Хоолой", labelEn: "Voice" },
  { id: "llm" as const, icon: Brain, labelMn: "AI Тархи", labelEn: "AI Brain" },
]

export default function ModelsPage() {
  const [locale, setLocale] = useState<"en" | "mn">("mn")
  const [selectedCategory, setSelectedCategory] = useState<ModelCategory>("video")
  const [selectedModels, setSelectedModels] = useState<Record<ModelCategory, string>>({
    video: "kling-standard",
    image: "flux-schnell",
    voice: "camb-mars-pro",
    llm: "claude-sonnet",
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const filteredModels = models.filter((m) => m.category === selectedCategory)

  const handleSelectModel = (modelId: string) => {
    setSelectedModels((prev) => ({
      ...prev,
      [selectedCategory]: modelId,
    }))
  }

  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case "fast":
        return <Zap className="h-3 w-3 text-green-500" />
      case "medium":
        return <Clock className="h-3 w-3 text-yellow-500" />
      case "slow":
        return <Clock className="h-3 w-3 text-orange-500" />
    }
  }

  const getQualityStars = (quality: string) => {
    const count = quality === "ultra" ? 3 : quality === "high" ? 2 : 1
    return Array(count)
      .fill(0)
      .map((_, i) => <Star key={i} className="h-3 w-3 fill-accent text-accent" />)
  }

  const getCostIndicator = (cost: string) => {
    const count = cost === "high" ? 3 : cost === "medium" ? 2 : 1
    return (
      <div className="flex gap-0.5">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <DollarSign
              key={i}
              className={cn("h-3 w-3", i < count ? "text-accent" : "text-muted-foreground/30")}
            />
          ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
              </span>
              <span className="text-lg font-bold tracking-tight">VexoAi</span>
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">
              {locale === "mn" ? "AI Модел" : "AI Models"}
            </span>
          </div>
          <button
            onClick={() => setLocale(locale === "mn" ? "en" : "mn")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "mn" ? "EN" : "MN"}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <AppSidebar locale={locale} onCollapsedChange={setSidebarCollapsed} />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "md:ml-16" : "md:ml-56"}`}>
        <div className={`mx-auto px-4 sm:px-6 py-8 transition-all duration-300 ${sidebarCollapsed ? "max-w-6xl" : "max-w-5xl"}`}>
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">
              {locale === "mn" ? "AI Модел сонгох" : "Choose AI Models"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {locale === "mn"
                ? "Таны төсөлд тохирох AI моделийг сонгоно уу"
                : "Select the AI models that best fit your project"}
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {categories.map((cat) => {
              const Icon = cat.icon
              const isActive = selectedCategory === cat.id
              const selectedModel = models.find((m) => m.id === selectedModels[cat.id])
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap",
                    isActive
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-secondary/50 border-border hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {locale === "mn" ? cat.labelMn : cat.labelEn}
                  </span>
                  {selectedModel && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isActive ? "bg-accent-foreground/20" : "bg-accent/20 text-accent"
                    )}>
                      {selectedModel.name.split(" ")[0]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Models Summary */}
          <div className="mb-6 p-4 rounded-xl bg-secondary/30 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium">
                {locale === "mn" ? "Таны сонгосон моделууд" : "Your Selected Models"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon
                const model = models.find((m) => m.id === selectedModels[cat.id])
                return (
                  <div key={cat.id} className="flex items-center gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{locale === "mn" ? cat.labelMn : cat.labelEn}:</span>
                    <span className="font-medium truncate">{model?.name.split(" ").slice(0, 2).join(" ")}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Models Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((model) => {
              const isSelected = selectedModels[selectedCategory] === model.id
              return (
                <div
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={cn(
                    "relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-lg",
                    isSelected
                      ? "bg-accent/10 border-accent shadow-accent/20"
                      : "bg-secondary/30 border-border hover:border-accent/50"
                  )}
                >
                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {model.isDefault && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent/20 text-accent">
                        Default
                      </span>
                    )}
                    {model.isNew && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-500">
                        New
                      </span>
                    )}
                    {model.isPro && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-500">
                        Pro
                      </span>
                    )}
                  </div>

                  {/* Selected Check */}
                  {isSelected && (
                    <div className="absolute top-3 left-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                        <Check className="h-3 w-3 text-accent-foreground" />
                      </div>
                    </div>
                  )}

                  {/* Model Info */}
                  <div className={cn("mb-3", isSelected && "ml-7")}>
                    <h3 className="font-semibold">{model.name}</h3>
                    <p className="text-xs text-muted-foreground">{model.provider}</p>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {locale === "mn" ? model.descriptionMn : model.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      {getSpeedIcon(model.speed)}
                      <span className="text-muted-foreground">
                        {model.speed === "fast"
                          ? locale === "mn" ? "Хурдан" : "Fast"
                          : model.speed === "medium"
                          ? locale === "mn" ? "Дунд" : "Medium"
                          : locale === "mn" ? "Удаан" : "Slow"}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">{getQualityStars(model.quality)}</div>
                    {getCostIndicator(model.cost)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info Note */}
          <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">
                  {locale === "mn" ? "Модел солих тухай" : "About switching models"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {locale === "mn"
                    ? "Модел бүр өөр өөр чанар, хурд, үнэтэй. Pro моделууд илүү өндөр чанартай боловч илүү их кредит шаарддаг. Туршилтаар эхлэхдээ Default моделуудыг ашиглахыг зөвлөж байна."
                    : "Each model has different quality, speed, and cost. Pro models offer higher quality but require more credits. We recommend starting with Default models for testing."}
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              {locale === "mn" ? "Хадгалах" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
