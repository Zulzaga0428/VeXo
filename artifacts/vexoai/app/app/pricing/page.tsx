"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Crown,
  CreditCard,
  Check,
  ArrowLeft,
  Loader2,
  QrCode,
  X,
} from "lucide-react"

const plans = [
  {
    id: "credits_10",
    name: "75 Credits",
    nameMn: "75 Кредит",
    price: 40000,
    credits: 75,
    description: "≈10 Standard / 6 Pro / 2 Premium видео",
    descriptionEn: "≈10 Standard / 6 Pro / 2 Premium videos",
  },
  {
    id: "credits_30",
    name: "95 Credits",
    nameMn: "95 Кредит",
    price: 60000,
    credits: 95,
    popular: true,
    description: "≈13 Standard / 7 Pro / 3 Premium видео",
    descriptionEn: "≈13 Standard / 7 Pro / 3 Premium videos",
  },
  {
    id: "credits_100",
    name: "180 Credits",
    nameMn: "180 Кредит",
    price: 80000,
    credits: 180,
    description: "≈25 Standard / 13 Pro / 7 Premium видео",
    descriptionEn: "≈25 Standard / 13 Pro / 7 Premium videos",
  },
]

export default function PricingPage() {
  const [locale, setLocale] = useState<"en" | "mn">("mn")
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrData, setQrData] = useState<{
    qrImage: string
    invoiceId: string
    urls: Array<{ name: string; logo?: string; link: string }>
  } | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const supabase = createClient()

  const handlePurchase = async (plan: typeof plans[0]) => {
    setSelectedPlan(plan)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }

      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType: plan.id,
          amount: plan.price,
          credits: plan.credits,
        }),
      })

      const data = await res.json()
      if (data.qrImage) {
        setQrData({
          qrImage: data.qrImage,
          invoiceId: data.invoiceId,
          urls: data.bankUrls || [],
        })
      }
    } catch (error) {
      console.error("Payment error:", error)
    } finally {
      setLoading(false)
    }
  }

  const checkPayment = async () => {
    if (!qrData?.invoiceId) return
    setCheckingPayment(true)

    try {
      const res = await fetch(`/api/payment/check?invoiceId=${qrData.invoiceId}`)
      const data = await res.json()

      if (data.paid) {
        setPaymentSuccess(true)
        // Refresh credits
        setTimeout(() => {
          window.location.href = "/app/dashboard"
        }, 2000)
      } else {
        alert(locale === "mn" ? "Төлбөр хараахан төлөгдөөгүй байна" : "Payment not completed yet")
      }
    } catch (error) {
      console.error("Check payment error:", error)
    } finally {
      setCheckingPayment(false)
    }
  }

  const closeModal = () => {
    setQrData(null)
    setSelectedPlan(null)
    setPaymentSuccess(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
            </span>
            <span className="text-lg font-bold tracking-tight">VexoAi</span>
          </Link>
          <span className="font-semibold text-sm">{locale === "mn" ? "Кредит авах" : "Buy Credits"}</span>
          <button
            onClick={() => setLocale(locale === "mn" ? "en" : "mn")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {locale === "mn" ? "EN" : "MN"}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <AppSidebar locale={locale} />

      {/* Content - with sidebar offset */}
      <div className="ml-0 md:ml-56 transition-all duration-300">
        <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold">
            {locale === "mn" ? "Кредит худалдаж авах" : "Purchase Credits"}
          </h1>
          <p className="text-muted-foreground">
            {locale === "mn"
              ? "Илүү олон видео үүсгэхийн тулд кредит худалдаж аваарай"
              : "Buy credits to generate more videos"}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 transition-all hover:border-accent/50 ${
                plan.popular ? "border-accent bg-accent/5" : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  {locale === "mn" ? "Хамгийн их" : "Popular"}
                </div>
              )}

              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" />
                <span className="font-semibold">
                  {locale === "mn" ? plan.nameMn : plan.name}
                </span>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price.toLocaleString()}</span>
                <span className="text-muted-foreground"> MNT</span>
              </div>

              <p className="mb-6 text-sm text-muted-foreground">
                {locale === "mn" ? plan.description : plan.descriptionEn}
              </p>

              <ul className="mb-6 space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent" />
                  {plan.credits} {locale === "mn" ? "кредит" : "credits"}
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                  <span className="text-muted-foreground">
                    {locale === "mn" ? plan.description : plan.descriptionEn}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent" />
                  {locale === "mn" ? "Монгол хоолой (TTS)" : "Mongolian voice (TTS)"}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent" />
                  {locale === "mn" ? "7 хоног хадгалах" : "7 days storage"}
                </li>
              </ul>

              <Button
                onClick={() => handlePurchase(plan)}
                disabled={loading && selectedPlan?.id === plan.id}
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
              >
                {loading && selectedPlan?.id === plan.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                {locale === "mn" ? "Худалдаж авах" : "Purchase"}
              </Button>
            </div>
          ))}
        </div>
      </main>
      </div>

      {/* QR Code Modal */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            {paymentSuccess ? (
              <div className="py-8 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                    <Check className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {locale === "mn" ? "Амжилттай!" : "Success!"}
                </h3>
                <p className="text-muted-foreground">
                  {locale === "mn"
                    ? "Таны кредит нэмэгдлээ. Удахгүй шилжинэ..."
                    : "Your credits have been added. Redirecting..."}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-center">
                  <QrCode className="mx-auto mb-2 h-6 w-6 text-accent" />
                  <h3 className="text-lg font-semibold">
                    {locale === "mn" ? "QPay-ээр төлөх" : "Pay with QPay"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlan?.price.toLocaleString()} MNT - {selectedPlan?.credits} {locale === "mn" ? "кредит" : "credits"}
                  </p>
                </div>

                <div className="mb-4 flex justify-center">
                  <img
                    src={`data:image/png;base64,${qrData.qrImage}`}
                    alt="QPay QR Code"
                    className="h-48 w-48 rounded-lg"
                  />
                </div>

                <p className="mb-4 text-center text-xs text-muted-foreground">
                  {locale === "mn"
                    ? "Банкны аппаараа QR кодыг уншуулна уу"
                    : "Scan QR code with your banking app"}
                </p>

                {/* Bank Apps */}
                {qrData.urls.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-center text-xs text-muted-foreground">
                      {locale === "mn" ? "Эсвэл банкны апп сонгох:" : "Or select your bank:"}
                    </p>
                    <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto">
                      {qrData.urls.map((bank: { name: string; logo?: string; link: string }) => (
                        <a
                          key={bank.name}
                          href={bank.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center transition-colors hover:bg-secondary hover:border-accent"
                        >
                          {bank.logo && (
                            <img src={bank.logo} alt={bank.name} className="h-8 w-8 rounded" />
                          )}
                          <span className="text-[10px] text-muted-foreground line-clamp-1">{bank.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={checkPayment}
                  disabled={checkingPayment}
                  className="w-full"
                >
                  {checkingPayment ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {locale === "mn" ? "Төлбөр шалгах" : "Check Payment"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
