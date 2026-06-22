import { PromptLibraryManager } from "@/components/admin/prompt-library-manager"

export const metadata = {
  title: "Free Prompt удирдах · VexoAi Admin",
}

export default function AdminPromptLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Free Prompt</h1>
        <p className="text-sm text-muted-foreground">
          Бэлэн чанартай промптуудыг зураг/бичлэгтэй нь оруулна. Хэрэглэгчид эндээс хуулж авна.
        </p>
      </div>
      <PromptLibraryManager />
    </div>
  )
}
