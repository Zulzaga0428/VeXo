import { type NextRequest, NextResponse } from "next/server"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

export async function POST(request: NextRequest) {
  try {
    const { prompt, type = "image" } = await request.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
    }

    const systemPrompt = type === "image"
      ? `You are an expert AI image prompt engineer. Enhance the user's prompt to create stunning, detailed images. 
Add specific details about: lighting, composition, camera angle, mood, color palette, art style, and quality modifiers.
Keep it concise (max 80 words). Return ONLY the enhanced English prompt, no explanations.`
      : `You are an expert AI video prompt engineer. Enhance the user's prompt for video generation.
Add details about: camera movement, scene composition, lighting, mood, action flow.
Keep it concise (max 80 words). Return ONLY the enhanced English prompt, no explanations.`

    const charge = await chargeCredits(CREDIT_COST.enhance)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let response: Response
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 300,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Enhance this prompt: "${prompt}"`,
            },
          ],
        }),
      })
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.enhance)
      throw e
    }

    if (!response.ok) {
      await refundCredits(charge.userId, CREDIT_COST.enhance)
      const errorText = await response.text()
      console.error("[v0] Claude API error:", errorText)
      return NextResponse.json({ error: "Failed to enhance prompt" }, { status: 500 })
    }

    const data = await response.json()
    const enhancedPrompt = data.content?.[0]?.text?.trim() || prompt

    return NextResponse.json({ enhancedPrompt })
  } catch (error) {
    console.error("[v0] Enhance prompt error:", error)
    return NextResponse.json({ error: "Failed to enhance prompt" }, { status: 500 })
  }
}
