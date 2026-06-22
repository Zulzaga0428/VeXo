"use client"

import { LegalPageLayout } from "@/components/legal-page-layout"
import { Mail, MessageCircle, Globe } from "lucide-react"

export default function ContactPage() {
  return (
    <LegalPageLayout title={{ mn: "Холбоо барих", en: "Contact Us" }}>
      {(locale) => (
        <>
          <p>
            {locale === "mn"
              ? "VexoAi багтай холбогдох хамгийн хурдан арга бол доорх хаягаар имэйл бичих юм. Бид 1-2 ажлын өдрийн дотор хариу өгнө."
              : "The fastest way to reach the VexoAi team is via the email addresses below. We typically respond within 1-2 business days."}
          </p>

          <div className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
            <ContactCard
              icon={<Mail className="h-5 w-5 text-accent" />}
              title={locale === "mn" ? "Ерөнхий асуулт" : "General inquiries"}
              value="hello@vexoai.studio"
              href="mailto:hello@vexoai.studio"
            />
            <ContactCard
              icon={<Mail className="h-5 w-5 text-accent" />}
              title={locale === "mn" ? "Дэмжлэг" : "Support"}
              value="support@vexoai.studio"
              href="mailto:support@vexoai.studio"
            />
            <ContactCard
              icon={<Mail className="h-5 w-5 text-accent" />}
              title={locale === "mn" ? "Нууцлал" : "Privacy"}
              value="privacy@vexoai.studio"
              href="mailto:privacy@vexoai.studio"
            />
            <ContactCard
              icon={<Mail className="h-5 w-5 text-accent" />}
              title={locale === "mn" ? "Бизнес, хамтын ажиллагаа" : "Business & partnerships"}
              value="business@vexoai.studio"
              href="mailto:business@vexoai.studio"
            />
          </div>

          <h2>{locale === "mn" ? "Тогтмол асуултууд" : "Frequently asked"}</h2>
          <h3>{locale === "mn" ? "Кредит буцаалт хийдэг үү?" : "Do you offer refunds?"}</h3>
          <p>
            {locale === "mn"
              ? "Худалдан авсан кредит ерөнхийдөө буцаалт хийдэггүй. Гэхдээ техникийн алдаа, давхардсан төлбөртэй холбоотой бол support@vexoai.studio руу хандана уу."
              : "Purchased credits are generally non-refundable. However, for technical issues or duplicate charges, please contact support@vexoai.studio."}
          </p>

          <h3>{locale === "mn" ? "Бизнесийн хэрэглээнд тусгай үнэ байдаг уу?" : "Do you offer business pricing?"}</h3>
          <p>
            {locale === "mn"
              ? "Тийм. Сард 1000+ кредит хэрэглэдэг бизнесүүдэд тусгай хөнгөлөлттэй үнэ санал болгодог. business@vexoai.studio руу холбогдоно уу."
              : "Yes. Businesses using 1000+ credits per month qualify for discounted pricing. Reach us at business@vexoai.studio."}
          </p>

          <h3>{locale === "mn" ? "Хариу авах хугацаа?" : "Response time?"}</h3>
          <p>
            {locale === "mn"
              ? "Бид Даваагаас Баасан гарагт 1-2 ажлын өдрийн дотор хариу өгөхийг зорьдог. Амралтын өдрүүдэд илүү хугацаа шаардлагатай байж болно."
              : "We aim to respond within 1-2 business days, Monday through Friday. Weekends may take longer."}
          </p>
        </>
      )}
    </LegalPageLayout>
  )
}

function ContactCard({
  icon,
  title,
  value,
  href,
}: {
  icon: React.ReactNode
  title: string
  value: string
  href: string
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-accent/40 hover:bg-accent/5"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
          {value}
        </p>
      </div>
    </a>
  )
}
