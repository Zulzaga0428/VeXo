"use client"

import { LegalPageLayout } from "@/components/legal-page-layout"

export default function PrivacyPage() {
  return (
    <LegalPageLayout title={{ mn: "Нууцлалын бодлого", en: "Privacy Policy" }}>
      {(locale) => (locale === "mn" ? <PrivacyMn /> : <PrivacyEn />)}
    </LegalPageLayout>
  )
}

function PrivacyMn() {
  return (
    <>
      <p>
        VexoAi нь таны хувийн мэдээлэлийг хүндэтгэн үздэг. Энэхүү бодлого нь бид ямар мэдээлэл цуглуулдаг, юунд хэрэглэдэг,
        хэрхэн хадгалдаг талаар тайлбарлана.
      </p>

      <h2>1. Цуглуулдаг мэдээлэл</h2>
      <h3>Та өөрөө өгөх мэдээлэл</h3>
      <ul>
        <li>Имэйл хаяг (бүртгэлд)</li>
        <li>Нэр, аватар зураг, био (профайл оруулсан тохиолдолд)</li>
        <li>Та оруулсан зураг, видео, prompt текст</li>
        <li>Төлбөрийн мэдээлэл (3-р талын төлбөрийн систем дамжуулдаг)</li>
      </ul>

      <h3>Автоматаар цуглуулагдах мэдээлэл</h3>
      <ul>
        <li>IP хаяг, browser төрөл, төхөөрөмжийн мэдээлэл</li>
        <li>Сайт ашиглах загвар (хуудас үзсэн, дарсан товч)</li>
        <li>Cookie ба ижил төрлийн технологи</li>
      </ul>

      <h2>2. Мэдээллийг ашиглах зорилго</h2>
      <ul>
        <li>Үйлчилгээг үзүүлэх, кредит, төлбөрийн боловсруулалт</li>
        <li>AI зураг, видео үүсгэх процесст ашиглах</li>
        <li>Хэрэглэгчийн дэмжлэг үзүүлэх</li>
        <li>Үйлчилгээг сайжруулах, шинэ боломж нэмэх</li>
        <li>Аюулгүй байдал, луйврын эсрэг хяналт</li>
        <li>Хууль ёсны үүргийн дагуу</li>
      </ul>

      <h2>3. Мэдээллийг хуваалцах</h2>
      <p>
        Бид таны хувийн мэдээллийг гуравдагч этгээдэд <strong>зардаггүй</strong>. Дараах тохиолдолд л хуваалцана:
      </p>
      <ul>
        <li>
          <strong>Үйлчилгээ үзүүлэгч:</strong> Supabase (нэвтрэлт, өгөгдлийн сан), Vercel (hosting), FAL (AI image
          generation), Stripe/QPay (төлбөр)
        </li>
        <li>
          <strong>Хууль ёсны шаардлага:</strong> Хууль хяналтын байгууллагын бичгийн хүсэлт ирвэл
        </li>
        <li>
          <strong>Таны зөвшөөрөлтэйгээр:</strong> Жишээ нь, gallery-д нийтлэх үед таны контент бүх хүнд харагдана
        </li>
      </ul>

      <h2>4. Контентын нууцлал</h2>
      <p>
        Та оруулсан зураг, видеог хүсээгүй цагт зөвхөн та л харна. Зөвхөн та өөрөө "Gallery-д хуваалцах" товч дарсан
        тохиолдолд бусад хэрэглэгчид харах боломжтой болно.
      </p>

      <h2>5. Мэдээллийн хадгалалт</h2>
      <p>
        Таны мэдээлэл аюулгүй сервер дээр (Supabase, Vercel) шифрлэгдсэн байдлаар хадгалагддаг. Бид аюулгүй байдлын
        стандарт практикийг ашигладаг боловч интернэтэд 100%-ийн баталгаа гэж байхгүй.
      </p>

      <h2>6. Таны эрх</h2>
      <ul>
        <li>Хувийн мэдээллээ хүссэн үедээ үзэх, засах</li>
        <li>Дансаа устгах хүсэлт гаргах (бүх контент устах болно)</li>
        <li>Маркетингийн имэйлээс татгалзах</li>
        <li>Мэдээллийнхээ хуулбарыг хүсэх</li>
      </ul>

      <h2>7. Cookie</h2>
      <p>
        Бид нэвтрэлт хадгалах, хэлний тохиргоо, хэрэглэгчийн зан төлөвийг хэмжихэд cookie ашигладаг. Browser-ийн
        тохиргооноос хүссэн үедээ цэвэрлэж болно.
      </p>

      <h2>8. Хүүхдийн нууцлал</h2>
      <p>
        VexoAi нь 18-аас доош насныханд зориулагдаагүй. Хэрэв 18-аас доош насны хүний мэдээлэл цуглуулсныг олж мэдвэл
        нэн даруй устгана.
      </p>

      <h2>9. Бодлогын өөрчлөлт</h2>
      <p>
        Бид энэхүү бодлогыг үе үе шинэчилж магадгүй. Чухал өөрчлөлтийн талаар имэйлээр эсвэл сайт дээр мэдэгдэнэ.
      </p>

      <h2>10. Холбоо барих</h2>
      <p>
        Нууцлалтай холбоотой асуулт, хүсэлт байвал <a href="mailto:privacy@vexoai.studio">privacy@vexoai.studio</a>{" "}
        хаягаар холбогдоно уу.
      </p>

      <p className="text-sm text-muted-foreground mt-8 pt-4 border-t border-border">
        VexoAi · Улаанбаатар, Монгол улс
      </p>
    </>
  )
}

function PrivacyEn() {
  return (
    <>
      <p>
        VexoAi respects your privacy. This policy explains what information we collect, how we use it, and how it is
        stored.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>Email address (for registration)</li>
        <li>Name, avatar, bio (if added to your profile)</li>
        <li>Images, videos, and prompt text you submit</li>
        <li>Payment information (handled by third-party processors)</li>
      </ul>

      <h3>Automatically collected</h3>
      <ul>
        <li>IP address, browser type, device information</li>
        <li>Usage patterns (pages viewed, buttons clicked)</li>
        <li>Cookies and similar technologies</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To provide the service, process credits and payments</li>
        <li>To run AI image and video generation</li>
        <li>To provide customer support</li>
        <li>To improve and add new features</li>
        <li>For security and fraud prevention</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>3. Sharing of Information</h2>
      <p>
        We do <strong>not</strong> sell your personal data. We share it only in these cases:
      </p>
      <ul>
        <li>
          <strong>Service providers:</strong> Supabase (auth, database), Vercel (hosting), FAL (AI image generation),
          Stripe/QPay (payments)
        </li>
        <li>
          <strong>Legal requirements:</strong> If required by a lawful written request from authorities
        </li>
        <li>
          <strong>With your consent:</strong> e.g., when you publish to the gallery, your content becomes visible to
          everyone
        </li>
      </ul>

      <h2>4. Content Privacy</h2>
      <p>
        Images and videos you upload are private by default — only you can see them. They become visible to others
        only after you choose to share them publicly via the gallery.
      </p>

      <h2>5. Data Storage</h2>
      <p>
        Your data is stored encrypted on secure servers (Supabase, Vercel). We use industry-standard security
        practices, but no system on the internet is 100% guaranteed.
      </p>

      <h2>6. Your Rights</h2>
      <ul>
        <li>View or edit your personal data at any time</li>
        <li>Request account deletion (which removes all your content)</li>
        <li>Opt out of marketing emails</li>
        <li>Request a copy of your data</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>
        We use cookies for session management, language preferences, and basic analytics. You can clear them at any
        time from your browser settings.
      </p>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        VexoAi is not intended for users under 18. If we discover that we have collected data from a minor, we will
        delete it immediately.
      </p>

      <h2>9. Changes to this Policy</h2>
      <p>
        We may update this policy from time to time. For significant changes, we will notify you via email or through
        the site.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy-related questions or requests, please contact{" "}
        <a href="mailto:privacy@vexoai.studio">privacy@vexoai.studio</a>.
      </p>

      <p className="text-sm text-muted-foreground mt-8 pt-4 border-t border-border">
        VexoAi · Ulaanbaatar, Mongolia
      </p>
    </>
  )
}
