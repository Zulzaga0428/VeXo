import { GalleryClient } from "@/components/gallery/gallery-client"
import { LandingHeader } from "@/components/landing-header"

export const metadata = {
  title: "Gallery — VexoAi",
  description: "Хэрэглэгчдийн бүтээсэн AI видео, зургуудыг үзэх, лайк, сэтгэгдэл бичих",
}

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 sm:pt-28 pb-16">
        <GalleryClient />
      </main>
    </div>
  )
}
