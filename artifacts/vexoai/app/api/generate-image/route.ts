import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

fal.config({
  credentials: process.env.FAL_KEY,
})

// Aspect ratio -> image size mapping
const aspectRatioMap: Record<string, string> = {
  "9:16": "portrait_16_9",
  "1:1": "square_hd",
  "16:9": "landscape_16_9",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, imageUrl, aspectRatio = "1:1", mode = "photo" } = body
    // How many images to return (1-4). Scene posters only need one.
    const numImages = Math.min(Math.max(parseInt(body.numImages, 10) || 4, 1), 4)

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Use the user's prompt verbatim — no forced style suffix.
    const enhancedPrompt = prompt

    const imageSize = aspectRatioMap[aspectRatio] || "square_hd"
    // Ideogram uses colon-style aspect ratios directly
    const ideogramRatio = ["9:16", "1:1", "16:9", "4:3", "3:4"].includes(aspectRatio)
      ? aspectRatio
      : "1:1"

    const charge = await chargeCredits(CREDIT_COST.image)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let result: any

    try {
      if (imageUrl) {
        // Image-to-image with Flux Dev.
        // strength 0.55 (was 0.85) — lower strength preserves the original
        // person's face and identity while still allowing outfit / background
        // changes. At 0.85 the model almost fully regenerates the image and
        // replaces the face with a random one.
        const facePrefix = "Preserve the exact face, skin tone, and identity of the original person. "
        result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
          input: {
            prompt: facePrefix + enhancedPrompt,
            image_url: imageUrl,
            strength: 0.55,
            num_images: numImages,
            num_inference_steps: 28,
            guidance_scale: 3.5,
          },
        })
      } else if (mode === "poster") {
        // Poster mode -> Ideogram V2 (best for text / typography in image)
        result = await fal.subscribe("fal-ai/ideogram/v2", {
          input: {
            prompt,
            aspect_ratio: ideogramRatio,
            expand_prompt: true,
            num_images: numImages,
          } as any,
        })
      } else {
        // Photo mode -> FLUX 1.1 [pro] (high quality)
        result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
          input: {
            prompt: enhancedPrompt,
            image_size: imageSize,
            num_images: numImages,
            safety_tolerance: "2",
            output_format: "jpeg",
          } as any,
        })
      }
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.image)
      throw e
    }

    const images = result?.data?.images || result?.images || []
    if (images.length === 0) {
      await refundCredits(charge.userId, CREDIT_COST.image)
      throw new Error("No images generated")
    }

    return NextResponse.json({
      images: images.map((img: any) => ({ url: img.url })),
    })
  } catch (error: any) {
    console.error("[v0] Image generation error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to generate image" },
      { status: 500 }
    )
  }
}
