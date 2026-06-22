import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { bumpChatUsage, DAILY_CHAT_LIMIT } from "@/lib/credits"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type PlannedScene = {
  summary: string // short MN description of what this scene shows
  visualPrompt: string // rich English visual prompt for the video model (motion)
  // When the user attached an image AND wants its setting/background/look changed
  // (e.g. "put me in an office"), this is an English image-to-image edit prompt
  // that transforms the photo while keeping the subject. Empty "" = animate the
  // image as-is (no edit).
  imageEditPrompt: string
  narration: string // suggested voice-over text (MN), tuned to the duration
  voiceGender: "male" | "female"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      idea,
      sceneCount = 3,
      duration = 10,
      locale = "mn",
      model = "standard",
      hasImages = false,
    } = body as {
      idea?: string
      sceneCount?: number
      duration?: number
      locale?: "mn" | "en"
      model?: "standard" | "veo3"
      // True when the user attached their own photo(s) to the scenes. Tells the
      // planner it may write image-edit prompts that transform those photos.
      hasImages?: boolean
    }

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "idea required" }, { status: 400 })
    }

    // The planner is free chat-style work, so it shares the daily chat limit.
    const limit = await bumpChatUsage()
    if (!limit.ok) {
      if (limit.status === 429) {
        return NextResponse.json(
          {
            error: "daily_chat_limit",
            limit: DAILY_CHAT_LIMIT,
            message:
              locale === "mn"
                ? `Өдрийн чатын хязгаарт (${DAILY_CHAT_LIMIT}) хүрлээ. Маргааш дахин оролдоно уу.`
                : `You've reached the daily chat limit (${DAILY_CHAT_LIMIT}). Please try again tomorrow.`,
          },
          { status: 429 },
        )
      }
      return NextResponse.json({ error: limit.error }, { status: limit.status })
    }

    // Words that comfortably fit a voice-over of `duration` seconds
    // (~2.2 Mongolian words per second feels natural, not rushed).
    const wordsPerScene = Math.max(6, Math.round(duration * 2.2))

    const count = [1, 2, 3, 5].includes(sceneCount) ? sceneCount : 3

    // Model-aware visual guidance. The two engines reward slightly different
    // prompt styles — telling the planner which one it's writing for noticeably
    // improves the result. This shapes ONLY the visualPrompt craft, never the
    // user's idea (we still follow whatever they asked for).
    const engineMn =
      model === "veo3"
        ? `Энэ бол Cinematic engine (Veo). Кино шиг камер (dolly, crane, tracking), нарийн гэрэлтүүлэг, гүн талбай (depth), өндөр чанарын дэлгэрэнгүйг онцол. Дүр ярьдаг бол ам, нүүрний хувиргалыг тодорхой бич.`
        : `Энэ бол Standard engine (Kling). Жигд, байгалийн хөдөлгөөн (smooth motion), тогтвортой дүр, тод субъект, цэвэр найрлагыг онцол. Хэт төвөгтэй камер бүү нэм — энгийн, гялалзсан хөдөлгөөн илүү сайн.`
    const engineEn =
      model === "veo3"
        ? `This is the Cinematic engine (Veo). Emphasize cinematic camera work (dolly, crane, tracking), nuanced lighting, depth of field, and high-fidelity detail. If a character speaks, describe mouth and facial expression clearly.`
        : `This is the Standard engine (Kling). Emphasize smooth natural motion, a stable consistent subject, a clear focal point, and clean composition. Avoid overly complex camera moves — simple, fluid motion renders best.`

    const structureMn = `visualPrompt-ийг ийм дарааллаар бүтэцлэ (нэг урсгал өгүүлбэр болгож): СУБЪЕКТ (хэн/юу, дэлгэрэнгүй) → ҮЙЛДЭЛ (юу хийж байна) → КАМЕР (өнцөг/хөдөлгөөн) → ГЭРЭЛ+ОРЧИН → УУР АМЬСГАЛ/ӨНГӨ.`
    const structureEn = `Structure visualPrompt in this order (as one flowing description): SUBJECT (who/what, detailed) → ACTION (what they do) → CAMERA (angle/movement) → LIGHTING+ENVIRONMENT → MOOD/COLOR.`

    // Image-edit guidance — ONLY when the user attached their own photo. This is
    // the key to requests like "put me in an office": we keep the user's subject
    // but transform the setting via image-to-image BEFORE animating.
    const imageGuidanceMn = hasImages
      ? `
ЧУХАЛ — Хэрэглэгч ӨӨРИЙН зураг хавсаргасан байна. Тэдний хүсэлтийг сайн ойлго:
- Хэрэв тэд орчин/дэвсгэр/байршил/хувцас/загварыг ӨӨРЧЛӨХ хүсвэл (жишээ: "намайг оффист", "хөдөө талд", "хувцсыг өөрчил") → "imageEditPrompt"-д АНГЛИАР зураг засах prompt бич. Энэ нь хүний НҮҮР, ТАНИХ ШИНЖ, бие галбирыг ХАДГАЛААД зөвхөн хүссэн зүйлийг өөрчилнө. Жишээ: "Place this exact person in a modern high-tech office, keep their face, hairstyle and clothing identical, professional lighting, seated at a desk with a computer." Хувцсыг өөрчил гэж хэлээгүй бол хувцсыг бүү өөрчил.
- Хэрэв тэд зүгээр зургийг хөдөлгөх/амьдруулах хүсвэл (орчныг өөрчлөхгүй) → "imageEditPrompt"-ийг хоосон "" үлдээ.
- visualPrompt-д ХӨДӨЛГӨӨНийг (камер, үйлдэл) бич — энэ нь зураг засагдсаны ДАРАА хэрхэн хөдлөхийг заана.`
      : `
"imageEditPrompt"-ийг үргэлж хоосон "" үлдээ (хэрэглэгч зураг хавсаргаагүй).`
    const imageGuidanceEn = hasImages
      ? `
IMPORTANT — The user attached THEIR OWN image. Understand their request carefully:
- If they want to CHANGE the setting/background/location/clothing/look (e.g. "put me in an office", "make it a countryside", "change my outfit") → write an English image-edit prompt in "imageEditPrompt". It must KEEP the person's face, identity and body, changing only what they asked. Example: "Place this exact person in a modern high-tech office, keep their face, hairstyle and clothing identical, professional lighting, seated at a desk with a computer." Don't change clothing unless they asked.
- If they just want to animate the image as-is (no setting change) → leave "imageEditPrompt" empty "".
- Put the MOTION (camera, action) in visualPrompt — it describes how the (possibly edited) image moves.`
      : `
Always leave "imageEditPrompt" empty "" (the user attached no image).`

    const systemPrompt =
      locale === "mn"
        ? `Чи VexoAi видеоны найруулагч. Хэрэглэгчийн санааг ${count} scene-ийн төлөвлөгөө болгоно.

Хамгийн чухал: хэрэглэгчийн санааг ДАГА. Тэдний хүссэн зүйлийг хий — өөрийн бодлоор реклам, уриалга, story arc БҮҮ нэм. Хэрэв тэд зүгээр нэг агшин (жишээ нь "цэцэрлэгт тоглож буй муур") хүсвэл, түүнийг л гарга. Хэрэв тэд реклам хүсвэл реклам хий. Санаа нь хэдийн дэлгэрэнгүй бол түүнийг хадгалж, зөвхөн scene болгон задал.

${engineMn}

Scene бүр ОЙРОЛЦООГООР ${duration} секунд. Хоолойны текст ~${wordsPerScene} үг (видеонд багтахаар). Хэрэв санаанд яриа тохирохгүй бол (жишээ нь чимээгүй агшин) narration-ийг хоосон үлдээж болно.

${structureMn}
${imageGuidanceMn}

Scene бүрд:
- "summary": Монголоор 1 өгүүлбэр — энэ scene-д юу харагдах вэ
- "visualPrompt": АНГЛИ визуал prompt (2-3 өгүүлбэр) — дээрх бүтцээр. Реалист, жинхэнэ амьдрал шиг (мультфильм/CGI биш).
- "imageEditPrompt": АНГЛИ зураг засах prompt эсвэл хоосон "" (дээрх зааврыг дага)
- "narration": Монгол хоолойны текст (~${wordsPerScene} үг) эсвэл тохирохгүй бол хоосон ""
- "voiceGender": "male" эсвэл "female"

${count} scene бол хоорондоо уялдаа холбоотой, ижил хэв маяг/өнгө/дүртэй байг (visualPrompt дотор дүрийг адилхан тодорхойл).
Зөвхөн JSON буцаа, өөр юм бүү бич.

Формат: {"scenes":[{"summary":"...","visualPrompt":"...","imageEditPrompt":"","narration":"...","voiceGender":"female"}]}`
        : `You are VexoAi's video director. Turn the user's idea into a ${count}-scene plan.

Most important: FOLLOW the user's idea. Make what they asked for — don't add ads, CTAs, or a story arc they didn't ask for. If they want a simple moment (e.g. "a cat playing in a garden"), just deliver that. If they want a commercial, make one. If the idea is already detailed, preserve it and just split it into scenes.

${engineEn}

Each scene is about ${duration} seconds. Narration should be ~${wordsPerScene} words (fits the video). If speech doesn't fit the idea (e.g. a quiet moment), narration can be empty.

${structureEn}
${imageGuidanceEn}

For each scene:
- "summary": one Mongolian sentence — what the scene shows
- "visualPrompt": ENGLISH visual prompt (2-3 sentences) — using the structure above. Photorealistic, true to life (not cartoon/CGI).
- "imageEditPrompt": ENGLISH image-edit prompt or empty "" (follow the guidance above)
- "narration": Mongolian voice-over (~${wordsPerScene} words), or empty "" if it doesn't fit
- "voiceGender": "male" or "female"

For ${count} scenes, keep them connected with consistent style/color/characters (describe the character identically inside visualPrompt).
Return ONLY JSON, nothing else.

Format: {"scenes":[{"summary":"...","visualPrompt":"...","imageEditPrompt":"","narration":"...","voiceGender":"female"}]}`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: idea.trim() }],
    })

    const text =
      message.content[0].type === "text" ? message.content[0].text : ""

    // Pull the JSON object out of the reply (model sometimes wraps it).
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not plan the episode. Please try again." },
        { status: 502 },
      )
    }

    let parsed: { scenes?: PlannedScene[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json(
        { error: "Could not parse the plan. Please try again." },
        { status: 502 },
      )
    }

    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, count) : []
    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "Empty plan. Please try again." },
        { status: 502 },
      )
    }

    // Normalize so the client always gets clean, expected shapes.
    const clean = scenes.map((s) => ({
      summary: typeof s.summary === "string" ? s.summary : "",
      visualPrompt: typeof s.visualPrompt === "string" ? s.visualPrompt : "",
      imageEditPrompt: typeof s.imageEditPrompt === "string" ? s.imageEditPrompt : "",
      narration: typeof s.narration === "string" ? s.narration : "",
      voiceGender: s.voiceGender === "male" ? "male" : "female",
    }))

    return NextResponse.json({
      scenes: clean,
      sceneCount: count,
      chatRemaining: limit.remaining,
    })
  } catch (error) {
    console.error("Plan episode error:", error)
    return NextResponse.json({ error: "Failed to plan" }, { status: 500 })
  }
}
