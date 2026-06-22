import { AdminVoicePreviewManager } from "@/components/admin/voice-preview-manager"

export const metadata = {
  title: "Хоолойн дээж · VexoAi Admin",
}

export default function AdminVoicePreviewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Хоолойн дээж (Preview)</h1>
        <p className="text-sm text-muted-foreground">
          Монгол студио хоолой бүрд богино (≈10 секунд) дээж бичлэг нэмнэ. Хэрэглэгч хоолой сонгох
          цэс дээр &quot;Сонсох&quot; дарахад TTS дуудалгүйгээр энэ дээжийг шууд тоглуулна (кредит
          зарцуулахгүй).
        </p>
      </div>
      <AdminVoicePreviewManager />
    </div>
  )
}
