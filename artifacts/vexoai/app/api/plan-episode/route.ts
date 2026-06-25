import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { bumpChatUsage, DAILY_CHAT_LIMIT } from "@/lib/credits"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type PlannedScene = {
  summary: string
  visualPrompt: string
  imageEditPrompt: string
  narration: string
  voiceGender: "male" | "female"
}

// Story arc templates — each scene gets a cinematic role based on total count
const ARC: Record<number, string[]> = {
  1: ["PEAK — The single most powerful, emotionally resonant moment. No setup needed — land directly in the core emotion or action."],
  2: [
    "HOOK — Grab attention immediately. Bold visual, surprising element, or arresting motion that makes the viewer stop scrolling.",
    "PAYOFF — Deliver the resolution, product reveal, or emotional reward. End on a feeling, not just an image.",
  ],
  3: [
    "HOOK (0-10s) — Open with the most visually striking frame. Establish world and character in one shot.",
    "BUILD (10-20s) — Deepen the story. Show the product/service in action, or the emotional core of the moment.",
    "RESOLVE (20-30s) — Close with brand identity, emotional payoff, or a lingering image that stays with the viewer.",
  ],
  5: [
    "ESTABLISH — Wide or environmental shot. Set the world, time of day, mood. Slow, breathing camera.",
    "CHARACTER/PROBLEM — Introduce the subject up close. Show tension, desire, or daily life.",
    "PRODUCT/SOLUTION — The hero moment. Product enters, skill is demonstrated, or the key action happens.",
    "EMOTION PEAK — The most intimate or dramatic frame. A look, a detail, a reaction. Make the viewer feel something.",
    "BRAND RESOLVE — Pull back. Logo, tagline territory, or a closing image that anchors the brand in memory.",
  ],
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
      hasImages?: boolean
    }

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "idea required" }, { status: 400 })
    }

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

    const wordsPerScene = Math.max(6, Math.round(duration * 2.2))
    const count = [1, 2, 3, 5].includes(sceneCount) ? sceneCount : 3
    const arcGuide = (ARC[count] ?? ARC[3]).map((role, i) => `  Scene ${i + 1}: ${role}`).join("\n")

    // ── Model-specific deep prompt engineering ──────────────────────────────
    const klingGuide = `
ENGINE: Kling v3 Standard — masters of fluid, photorealistic motion.
PROMPT PATTERNS THAT EXCEL IN KLING:
• "Close-up of [SUBJECT], [MICRO-ACTION — blink, breath, hair lifting], shallow depth of field, [LIGHTING], [COLOR]"
• "Camera slowly pushes in toward [SUBJECT], [ACTION], soft natural [light source] illumination"
• "Slow-motion [ACTION] — [SUBJECT] in frame, clean background, smooth 120fps-feel"
• "[SUBJECT] moves through [ENVIRONMENT], steady tracking shot, [ATMOSPHERE]"
WHAT KLING LOVES: consistent single subject, slow or medium motion, shallow DOF, natural lighting.
WHAT TO AVOID: multiple fast-moving subjects, complex crowd scenes, rapid cuts described in one prompt.`

    const veoGuide = `
ENGINE: Google Veo 3.1 Cinematic — unrivaled photorealism and cinematic depth.
PROMPT PATTERNS THAT EXCEL IN VEO:
• "Cinematic [dolly/crane/tracking] shot — [SUBJECT], [DETAILED ACTION], [COMPLEX LIGHTING SETUP], [ENVIRONMENT DETAIL], photorealistic 4K"
• "Wide establishing shot — [SWEEPING ENVIRONMENT], camera slowly cranes down to reveal [SUBJECT], [MOOD]"
• "Medium shot — [CHARACTER] [EMOTIONAL ACTION — speaks, reacts, transforms], [FACE DETAIL], [ATMOSPHERIC LIGHTING]"
• "Aerial view → [TRANSITION] → ground level reveal of [SUBJECT]"
WHAT VEO LOVES: complex environments, rich lighting, character emotion, camera choreography, depth-of-field transitions.
WHAT TO AVOID: too-simple single-shot descriptions — Veo thrives on layered, cinematic detail.`

    const engineGuide = model === "veo3" ? veoGuide : klingGuide

    // ── Visual consistency anchor ────────────────────────────────────────────
    const consistencyRule = `
VISUAL DNA — Establish once in Scene 1, lock for ALL scenes:
• CHARACTER ANCHOR: describe your lead character IDENTICALLY in every visualPrompt (same age, build, clothing color, hair, skin tone — exact same wording).
• COLOR PALETTE: pick 2-3 signature colors and reference them across scenes (e.g., "warm amber tones", "muted teal shadows").
• LIGHTING STYLE: lock one style (e.g., "soft golden-hour backlight", "cool blue studio lighting") and repeat it.
• This makes the final video feel like ONE cohesive film, not disconnected clips.`

    // ── Image guidance ──────────────────────────────────────────────────────
    const imageGuidanceMn = hasImages
      ? `
ЧУХАЛ — Хэрэглэгч ӨӨРИЙН зураг хавсаргасан:
- Орчин/дэвсгэр/байршил өөрчлөх хүсвэл → imageEditPrompt-д АНГЛИАР: "Place this exact person in [NEW SETTING], keep their face, hairstyle and clothing identical, [LIGHTING]." 
- Зөвхөн хөдөлгөхөд хүсвэл (орчин хэвээр) → imageEditPrompt-ийг "" хоосон үлдээ.
- visualPrompt-д ХӨДӨЛГӨӨН бич (зураг засагдсаны дараа хэрхэн хөдлөхийг).`
      : `imageEditPrompt-ийг үргэлж "" хоосон үлдээ.`

    const imageGuidanceEn = hasImages
      ? `
IMPORTANT — User attached their own image:
- To change setting/background: imageEditPrompt = "Place this exact person in [NEW SETTING], keep face, hairstyle and clothing identical, [LIGHTING]."
- To animate as-is: leave imageEditPrompt = "".
- visualPrompt describes the MOTION after any edit.`
      : `Always leave imageEditPrompt = "".`

    const systemPrompt =
      locale === "mn"
        ? `Чи VexoAi-н Ерөнхий Найруулагч — зөвхөн scene жагсаалт гаргах биш, жинхэнэ кино шиг харааны ертөнц бүтээдэг.

ХАМГИЙН ЧУХАЛ: Хэрэглэгчийн санааг ДАГА. Тэд хүссэн зүйлийг хий — нэмэлт реклам/CTA/уриалга бүү нэм. Санаа тодорхой бол хадгалж, зөвхөн scene болгон задал.

${engineGuide}

═══ STORY ARC — ${count} scene ═══
${arcGuide}

${consistencyRule}

Scene бүр ~${duration} секунд. Narration ~${wordsPerScene} үг.
${imageGuidanceMn}

Scene бүрд:
- "summary": Монголоор 1 өгүүлбэр (энэ scene-д юу харагдах)
- "visualPrompt": АНГЛИ, 2-3 өгүүлбэр. Дараалал: SUBJECT → ACTION → CAMERA → LIGHTING/ENV → MOOD. Photorealistic, кино шиг.
- "imageEditPrompt": АНГЛИ эсвэл ""
- "narration": Монгол (~${wordsPerScene} үг) эсвэл тохирохгүй бол ""
- "voiceGender": "male" эсвэл "female"

Зөвхөн JSON буцаа:
{"scenes":[{"summary":"...","visualPrompt":"...","imageEditPrompt":"","narration":"...","voiceGender":"female"}]}`
      : `You are VexoAi's Chief Director — not just listing scenes, but building a cohesive cinematic world.

MOST IMPORTANT: FOLLOW the user's idea exactly. Don't add unsolicited ads, CTAs, or story arcs. If the idea is detailed, preserve it and split into scenes.

${engineGuide}

═══ STORY ARC — ${count} scenes ═══
${arcGuide}

${consistencyRule}

Each scene ~${duration}s. Narration ~${wordsPerScene} words.
${imageGuidanceEn}

For each scene:
- "summary": 1 Mongolian sentence (what the scene shows)
- "visualPrompt": ENGLISH, 2-3 sentences. Order: SUBJECT → ACTION → CAMERA → LIGHTING/ENV → MOOD. Photorealistic, cinematic.
- "imageEditPrompt": ENGLISH or ""
- "narration": Mongolian (~${wordsPerScene} words) or "" if it doesn't fit
- "voiceGender": "male" or "female"

Return ONLY JSON:
{"scenes":[{"summary":"...","visualPrompt":"...","imageEditPrompt":"","narration":"...","voiceGender":"female"}]}`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: idea.trim() }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not plan the episode. Please try again." }, { status: 502 })
    }

    let parsed: { scenes?: PlannedScene[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: "Could not parse the plan. Please try again." }, { status: 502 })
    }

    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, count) : []
    if (scenes.length === 0) {
      return NextResponse.json({ error: "Empty plan. Please try again." }, { status: 502 })
    }

    const clean = scenes.map((s) => ({
      summary: typeof s.summary === "string" ? s.summary : "",
      visualPrompt: typeof s.visualPrompt === "string" ? s.visualPrompt : "",
      imageEditPrompt: typeof s.imageEditPrompt === "string" ? s.imageEditPrompt : "",
      narration: typeof s.narration === "string" ? s.narration : "",
      voiceGender: s.voiceGender === "male" ? "male" : "female",
    }))

    return NextResponse.json({ scenes: clean, sceneCount: count, chatRemaining: limit.remaining })
  } catch (error) {
    logger.error("Plan episode error:", { err: toErrStr(error) })
    return NextResponse.json({ error: "Failed to plan" }, { status: 500 })
  }
}
