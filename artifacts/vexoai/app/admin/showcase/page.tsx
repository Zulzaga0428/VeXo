import { AdminShowcaseManager } from "@/components/admin/showcase-manager"
import { LandingMediaManager } from "@/components/admin/landing-media-manager"

export const metadata = {
  title: "Showcase удирдах · VexoAi Admin",
}

export default function AdminShowcasePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Hero Slider</h1>
          <p className="text-sm text-muted-foreground">
            Нүүр хуудасны том slider-д харагдах зураг, видеог удирдана.
          </p>
        </div>
        <AdminShowcaseManager />
      </section>

      <div className="border-t border-border" />

      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Landing Media Slots</h1>
          <p className="text-sm text-muted-foreground">
            Нүүр хуудасны бусад хэсгийн зураг/видеог удирдана (жишээ нь Director preview).
          </p>
        </div>
        <LandingMediaManager />
      </section>
    </div>
  )
}
