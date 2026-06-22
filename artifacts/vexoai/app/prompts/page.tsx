import { PromptLibraryGrid } from "@/components/prompt-library/prompt-library-grid"
import { LandingHeader } from "@/components/landing-header"

export const metadata = {
  title: "Free Prompt — VexoAi",
  description: "Бэлэн чанартай промптуудыг хуулж аваад өөрийн видео, зургаа хийгээрэй.",
}

export default function PromptLibraryPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 sm:pt-28 pb-16">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">Free Prompt</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Бэлэн, чанартай промптуудаас сонгож хуулаад аваарай. Зураг, бичлэгийг нь үзээд таалагдсаныг
            нь өөрийн бүтээлдээ ашиглаарай.
          </p>
        </div>
        <PromptLibraryGrid />
      </main>
    </div>
  )
}
