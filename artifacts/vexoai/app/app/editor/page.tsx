"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import { ShareToGalleryDialog } from "@/components/share-to-gallery-dialog"
import {
  ImageIcon,
  Upload,
  Loader2,
  Download,
  Film,
  Check,
  X,
  Type,
  ImagePlus,
  Share2,
  LayoutTemplate,
  Camera,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "text-to-image" | "image-to-image"

const aspectRatios = [
  { id: "9:16", label: "9:16", desc: "Portrait", descMn: "Босоо" },
  { id: "1:1", label: "1:1", desc: "Square", descMn: "Дөрвөлжин" },
  { id: "16:9", label: "16:9", desc: "Landscape", descMn: "Хэвтээ" },
]

export default function ImageGeneratorPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<"mn" | "en">("mn")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("text-to-image")
  
  const [prompt, setPrompt] = useState("")
  const [mode, setMode] = useState<"photo" | "poster">("photo")
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Upload to FAL storage so the model can fetch a real https URL.
    // A local blob: URL only works in the browser and the model can't read it.
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setSourceImage(data.url)
      } else {
        alert(locale === "mn" ? "Зураг оруулахад алдаа гарлаа" : "Failed to upload image")
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert(locale === "mn" ? "Зураг оруулахад алдаа гарлаа" : "Failed to upload image")
    } finally {
      setIsUploading(false)
    }
  }

  const handleEnhance = async () => {
    if (!prompt.trim() || isEnhancing) return
    setIsEnhancing(true)
    try {
      const res = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "image" }),
      })
      const data = await res.json()
      if (data.enhancedPrompt) {
        setPrompt(data.enhancedPrompt)
      } else {
        alert(locale === "mn" ? "Сайжруулахад алдаа гарлаа" : "Failed to enhance")
      }
    } catch (error) {
      console.error("Enhance error:", error)
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setGeneratedImages([])
    setSelectedImage(null)
    
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageUrl: activeTab === "image-to-image" ? sourceImage : undefined,
          aspectRatio,
          mode,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate")
      }

      const urls = (data.images || []).map((img: { url: string }) => img.url)
      setGeneratedImages(urls)
    } catch (error) {
      console.error("Generation error:", error)
      alert(locale === "mn" ? "Зураг үүсгэхэд алдаа гарлаа" : "Failed to generate images")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendToVideo = () => {
    if (selectedImage !== null && generatedImages[selectedImage]) {
      // Store selected image and redirect to video creation
      sessionStorage.setItem("selectedImage", generatedImages[selectedImage])
      router.push("/app/studio")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-lg font-bold tracking-tight">VexoAi</span>
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-sm font-medium">
              {locale === "mn" ? "Зураг үүсгэх" : "Generate Image"}
            </span>
          </div>
          <button
            onClick={() => setLocale(locale === "mn" ? "en" : "mn")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {locale === "mn" ? "EN" : "MN"}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <AppSidebar locale={locale} onCollapsedChange={setSidebarCollapsed} />

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "md:ml-16" : "md:ml-56"
      )}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          
          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveTab("text-to-image")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "text-to-image"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Type className="h-4 w-4" />
              {locale === "mn" ? "Текстээс зураг" : "Text to Image"}
            </button>
            <button
              onClick={() => setActiveTab("image-to-image")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "image-to-image"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <ImagePlus className="h-4 w-4" />
              {locale === "mn" ? "Зургаас зураг" : "Image to Image"}
            </button>
          </div>

          {/* Input Section */}
          <div className="space-y-6 rounded-xl border border-border bg-card p-6">
            
            {/* Source Image (for image-to-image) */}
            {activeTab === "image-to-image" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {locale === "mn" ? "Эх зураг" : "Source Image"}
                </label>
                {sourceImage ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                    <Image
                      src={sourceImage}
                      alt="Source"
                      fill
                      className="object-contain bg-black/50"
                    />
                    <button
                      onClick={() => setSourceImage(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm">
                          {locale === "mn" ? "Оруулж байна..." : "Uploading..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">
                          {locale === "mn" ? "Зураг оруулах" : "Upload Image"}
                        </span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Mode: Photo vs Poster (text-to-image only) */}
            {activeTab === "text-to-image" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {locale === "mn" ? "Төрөл" : "Type"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("photo")}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                      mode === "photo"
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:text-foreground"
                    )}
                  >
                    <Camera className={cn("h-5 w-5 shrink-0", mode === "photo" ? "text-accent" : "text-muted-foreground")} />
                    <div>
                      <div className={cn("text-sm font-medium", mode === "photo" ? "text-accent" : "text-foreground")}>
                        {locale === "mn" ? "Зураг" : "Photo"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {locale === "mn" ? "Өндөр чанартай, фотореалист" : "High-quality, photoreal"}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("poster")}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                      mode === "poster"
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:text-foreground"
                    )}
                  >
                    <LayoutTemplate className={cn("h-5 w-5 shrink-0", mode === "poster" ? "text-accent" : "text-muted-foreground")} />
                    <div>
                      <div className={cn("text-sm font-medium", mode === "poster" ? "text-accent" : "text-foreground")}>
                        {locale === "mn" ? "Постер" : "Poster"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {locale === "mn" ? "Текст, бичигтэй (реклам)" : "With text / typography"}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  {locale === "mn" ? "Prompt" : "Prompt"}
                </label>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={!prompt.trim() || isEnhancing}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {locale === "mn" ? "Сайжруулж байна..." : "Enhancing..."}
                    </>
                  ) : (
                    <>{locale === "mn" ? "AI сайжруулах" : "AI Enhance"}</>
                  )}
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={locale === "mn" 
                  ? "Ямар зураг үүсгэхийг тайлбарлана уу..." 
                  : "Describe the image you want to generate..."
                }
                className="w-full h-24 px-4 py-3 rounded-lg bg-secondary/50 border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {locale === "mn" ? "Харьцаа" : "Aspect Ratio"}
              </label>
              <div className="flex gap-2">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setAspectRatio(ratio.id)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all",
                      aspectRatio === ratio.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div>{ratio.label}</div>
                    <div className="text-xs opacity-70">
                      {locale === "mn" ? ratio.descMn : ratio.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || (activeTab === "image-to-image" && !sourceImage)}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {locale === "mn" ? "Үүсгэж байна..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {locale === "mn" ? "Үүсгэх (1 credit)" : "Generate (1 credit)"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {(generatedImages.length > 0 || isGenerating) && (
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">
                  {locale === "mn" ? "Үр дүн" : "Results"}
                </h3>
                {selectedImage !== null && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Download selected image
                        const link = document.createElement("a")
                        link.href = generatedImages[selectedImage]
                        link.download = `vexoai-image-${Date.now()}.png`
                        link.click()
                      }}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {locale === "mn" ? "Татах" : "Download"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShareImageUrl(generatedImages[selectedImage])}
                      className="border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
                    >
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      {locale === "mn" ? "Хуваалцах" : "Share"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSendToVideo}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Film className="mr-1.5 h-3.5 w-3.5" />
                      {locale === "mn" ? "Видео үүсгэх" : "Create Video"}
                    </Button>
                  </div>
                )}
              </div>

              {isGenerating ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-secondary/50 animate-pulse flex items-center justify-center"
                    >
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        selectedImage === index
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-transparent hover:border-border"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`Generated ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {selectedImage === index && (
                        <div className="absolute top-2 right-2 p-1 rounded-full bg-accent">
                          <Check className="h-3 w-3 text-accent-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {generatedImages.length === 0 && !isGenerating && (
            <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {locale === "mn" ? "Зураг үүсгээгүй байна" : "No images generated yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {locale === "mn" 
                  ? "Prompt бичээд 'Үүсгэх' дарна уу" 
                  : "Enter a prompt and click 'Generate'"}
              </p>
            </div>
          )}
        </div>
      </div>

      {shareImageUrl && (
        <ShareToGalleryDialog
          imageUrl={shareImageUrl}
          defaultTitle={prompt}
          locale={locale}
          onClose={() => setShareImageUrl(null)}
        />
      )}
    </div>
  )
}
