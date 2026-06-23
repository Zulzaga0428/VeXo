"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Бүх талбарыг бөглөнө үү")
      return
    }

    if (password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (authError) {
      setError(authError.message === "User already registered" 
        ? "Энэ мэйл хаягаар бүртгэлтэй хэрэглэгч байна" 
        : authError.message)
      setIsLoading(false)
      return
    }

    // Create profile with 20 free starter credits (fire-and-forget, non-blocking)
    fetch("/api/auth/init-profile", { method: "POST" }).catch(() => null)

    // Email confirmation off — user is already logged in, go straight to app
    router.push("/app/create")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background effect */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
            </span>
            <span className="text-2xl font-bold">VexoAi</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Бүртгүүлэх</h1>
          <p className="mt-1 text-sm text-muted-foreground">Шинэ бүртгэл үүсгэх</p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
              Нэр
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Таны нэр"
              className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              Мэйл хаяг
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
              Нууц үг
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Хамгийн багадаа 6 тэмдэгт"
                className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isLoading}
          >
            {isLoading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
          </Button>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            Бүртгүүлснээр та манай{" "}
            <Link href="/terms" className="text-accent hover:underline">
              Үйлчилгээний нөхцөл
            </Link>
            {" "}болон{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Нууцлалын бодлого
            </Link>
            -г зөвшөөрч байна.
          </p>
        </form>

        {/* Links */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {"Бүртгэлтэй юу? "}
          <Link href="/login" className="text-accent hover:underline">
            Нэвтрэх
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    </div>
  )
}
