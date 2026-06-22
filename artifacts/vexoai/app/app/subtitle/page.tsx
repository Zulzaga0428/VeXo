"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Upload,
  Play,
  Pause,
  Download,
  FileText,
  Languages,
  Clock,
  Type,
  Wand2,
  Copy,
  Check,
  Loader2,
  Volume2,
  Settings,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SubtitleLine {
  id: string
  startTime: number
  endTime: number
  text: string
}

const languages = [
  { id: "mn", name: "Монгол", flag: "🇲🇳" },
  { id: "en", name: "English", flag: "🇺🇸" },
  { id: "ko", name: "한국어", flag: "🇰🇷" },
  { id: "zh", name: "中文", flag: "🇨🇳" },
  { id: "ja", name: "日本語", flag: "🇯🇵" },
  { id: "ru", name: "Русский", flag: "🇷🇺" },
]

const exportFormats = [
  { id: "srt", name: "SRT", desc: "SubRip Subtitle" },
  { id: "vtt", name: "VTT", desc: "WebVTT" },
  { id: "txt", name: "TXT", desc: "Plain Text" },
  { id: "json", name: "JSON", desc: "JSON Format" },
]

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`
}

export default function SubtitlePage() {
  const [locale, setLocale] = useState<"mn" | "en">("mn")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedLang, setSelectedLang] = useState("mn")
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setSubtitles([])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setSubtitles([])
    }
  }

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const generateSubtitles = async () => {
    if (!videoFile) return
    
    setIsGenerating(true)
    
    try {
      // 1. Upload video to Blob
      const formData = new FormData()
      formData.append("file", videoFile)
      
      const uploadRes = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadRes.json()
      
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Upload failed")
      }
      
      // 2. Generate subtitles with Whisper
      const subRes = await fetch("/api/generate-subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: uploadData.url,
          language: selectedLang,
        }),
      })
      const subData = await subRes.json()
      
      if (!subRes.ok || subData.error) {
        throw new Error(subData.error || "Failed to generate subtitles")
      }
      
      // 3. Map to SubtitleLine format
      const generated: SubtitleLine[] = (subData.subtitles || []).map((s: { id: number; start: number; end: number; text: string }) => ({
        id: String(s.id),
        startTime: s.start,
        endTime: s.end,
        text: s.text,
      }))
      
      setSubtitles(generated)
    } catch (error) {
      console.error("[v0] Subtitle error:", error)
      alert(locale === "mn" ? "Subtitle үүсгэхэд алдаа гарлаа" : "Failed to generate subtitles")
    } finally {
      setIsGenerating(false)
    }
  }

  const updateSubtitle = (id: string, field: keyof SubtitleLine, value: string | number) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, [field]: value } : sub
    ))
  }

  const deleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(sub => sub.id !== id))
  }

  const addSubtitle = () => {
    const lastSub = subtitles[subtitles.length - 1]
    const newStart = lastSub ? lastSub.endTime : currentTime
    const newSub: SubtitleLine = {
      id: Date.now().toString(),
      startTime: newStart,
      endTime: newStart + 3,
      text: "",
    }
    setSubtitles(prev => [...prev, newSub])
    setSelectedSubtitle(newSub.id)
  }

  const copyAllText = () => {
    const text = subtitles.map(s => s.text).join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportSubtitles = (format: string) => {
    let content = ""
    let filename = `subtitles.${format}`
    
    if (format === "srt") {
      content = subtitles.map((sub, i) => 
        `${i + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`
      ).join("\n")
    } else if (format === "vtt") {
      content = "WEBVTT\n\n" + subtitles.map(sub => 
        `${formatTime(sub.startTime).replace(",", ".")} --> ${formatTime(sub.endTime).replace(",", ".")}\n${sub.text}\n`
      ).join("\n")
    } else if (format === "txt") {
      content = subtitles.map(s => s.text).join("\n")
    } else if (format === "json") {
      content = JSON.stringify(subtitles, null, 2)
    }
    
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setShowExportMenu(false)
  }

  const currentSubtitle = subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-lg font-bold tracking-tight">VexoAi</span>
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">
              {locale === "mn" ? "Subtitle Үүсгэгч" : "Subtitle Generator"}
            </span>
          </div>
          <button
            onClick={() => setLocale(locale === "mn" ? "en" : "mn")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "mn" ? "EN" : "MN"}
          </button>
        </div>
      </nav>

      {/* Sidebar */}
      <AppSidebar locale={locale} onCollapsedChange={setSidebarCollapsed} />

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "md:ml-16" : "md:ml-56"
      )}>
        <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
          {/* Left Panel - Video */}
          <div className="flex-1 flex flex-col p-4 border-r border-border/50">
            {/* Video Player */}
            <div className="flex-1 relative rounded-xl overflow-hidden bg-black/50 border border-border">
              {videoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="max-w-full max-h-full"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Subtitle Overlay */}
                  {currentSubtitle && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 rounded-lg text-white text-center max-w-[80%]">
                      {currentSubtitle.text}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-sm">
                    {locale === "mn" ? "Видео чирж оруулах эсвэл сонгох" : "Drag & drop video or click to select"}
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-2">MP4, MOV, WebM</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Video Controls */}
            {videoUrl && (
              <div className="mt-4 space-y-3">
                {/* Progress Bar */}
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-accent rounded-full"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                  {/* Subtitle markers */}
                  {subtitles.map(sub => (
                    <div
                      key={sub.id}
                      className="absolute h-full bg-yellow-500/50"
                      style={{
                        left: `${(sub.startTime / duration) * 100}%`,
                        width: `${((sub.endTime - sub.startTime) / duration) * 100}%`,
                      }}
                    />
                  ))}
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value)
                      setCurrentTime(time)
                      if (videoRef.current) videoRef.current.currentTime = time
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={togglePlay}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(currentTime).slice(0, 8)} / {formatTime(duration).slice(0, 8)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Language Select */}
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5"
                    >
                      {languages.map(lang => (
                        <option key={lang.id} value={lang.id}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                    
                    {/* Generate Button */}
                    <Button
                      size="sm"
                      onClick={generateSubtitles}
                      disabled={isGenerating || !videoFile}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      {locale === "mn" ? "AI Subtitle" : "Generate"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Subtitles List */}
          <div className="w-full lg:w-96 flex flex-col border-t lg:border-t-0 border-border/50 bg-secondary/20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <span className="font-medium text-sm">
                  {locale === "mn" ? "Subtitle жагсаалт" : "Subtitles"}
                </span>
                <span className="text-xs text-muted-foreground">({subtitles.length})</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyAllText}
                  disabled={subtitles.length === 0}
                  className="h-8 w-8 p-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                
                {/* Export Menu */}
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={subtitles.length === 0}
                    className="h-8 px-2"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-10">
                      {exportFormats.map(format => (
                        <button
                          key={format.id}
                          onClick={() => exportSubtitles(format.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center justify-between"
                        >
                          <span>{format.name}</span>
                          <span className="text-xs text-muted-foreground">{format.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subtitles List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {subtitles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Type className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {locale === "mn" 
                      ? "Видео оруулаад AI Subtitle товч дарна уу" 
                      : "Upload video and click Generate"}
                  </p>
                </div>
              ) : (
                subtitles.map((sub, index) => (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubtitle(sub.id)
                      if (videoRef.current) {
                        videoRef.current.currentTime = sub.startTime
                      }
                    }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      selectedSubtitle === sub.id
                        ? "border-accent bg-accent/10"
                        : "border-border/50 bg-background/50 hover:border-border",
                      currentTime >= sub.startTime && currentTime <= sub.endTime
                        ? "ring-2 ring-yellow-500/50"
                        : ""
                    )}
                  >
                    {/* Time */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-accent">#{index + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(sub.startTime).slice(0, 8)} → {formatTime(sub.endTime).slice(0, 8)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSubtitle(sub.id)
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Text */}
                    <textarea
                      value={sub.text}
                      onChange={(e) => updateSubtitle(sub.id, "text", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={locale === "mn" ? "Текст оруулах..." : "Enter text..."}
                      className="w-full bg-transparent text-sm resize-none focus:outline-none min-h-[40px]"
                      rows={2}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Add Button */}
            {videoUrl && (
              <div className="p-3 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addSubtitle}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {locale === "mn" ? "Subtitle нэмэх" : "Add Subtitle"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
