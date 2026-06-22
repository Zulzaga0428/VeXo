# VexoAi

> Монгол хэлээр ярьдаг, найруулагчийн түвшинд бодож, видео бүтээдэг AI кино студи.

VexoAi бол Монгол брэндүүд болон контент бүтээгчдэд зориулсан AI-аар ажилладаг видео үйлдвэрлэлийн платформ юм. Энгийн санаа эсвэл prompt бичээд, найруулагчийн түвшний реклам, контент, дуу хоолой, гарчгийг хормын дотор үүсгэнэ.

[vexoai.studio](https://www.vexoai.studio)

---

## Онцлогууд

- **Видео үүсгэгч** — Текстээс шууд видео үүсгэх, найруулагчийн prompt-оор сайжруулна
- **Дуу хоолой** — 7 хэлний (Монгол, English, 中文, Русский, 한국어, 日本語, Español) олон төрлийн дуу хоолой
- **Хадмал орчуулга** — Видеонд автомат хадмал нэмэх
- **Image Editor** — AI-р зураг засварлах, хувиргах
- **Gallery** — Хэрэглэгчид бүтээлээ хуваалцаж, like/comment хийх нийгэмлэг
- **Profile** — Нийтийн профайл хуудас (`/u/username`)
- **Admin Panel** — Hero slider, landing media-г админ-аас удирдах
- **Олон хэлний UI** — Mongolian + English интерфейс
- **Light/Dark theme** — next-themes-тэй

---

## Технологи

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (Auth, Postgres, RLS)
- **Storage:** Vercel Blob
- **AI:** Fal AI (video, image), Vercel AI Gateway
- **Payments:** QPay (Mongolia)
- **Deployment:** Vercel

---

## Local-д ажиллуулах

```bash
git clone https://github.com/Zulzaga0428/VexiAI.git
cd VexiAI
pnpm install
pnpm dev
```

Browser-аас [http://localhost:3000](http://localhost:3000) нээнэ үү.

---

## Environment Variables

| Хувьсагч | Тайлбар |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token |
| `FAL_KEY` | Fal AI API key |
| `ADMIN_EMAILS` | Админ имэйлүүд, таслалаар тусгаарлана |
| `QPAY_*` | QPay merchant credentials |

---

[Continue working on v0 →](https://v0.app/chat/projects/prj_8vLtuJiDRIgr383sgZIZSpADQp1W)

© 2026 VexoAi
