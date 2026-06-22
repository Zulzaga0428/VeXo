// Kling API Auth - using direct key format
export function getKlingAuth(): string {
  const ak = process.env.KLING_ACCESS_KEY!
  const sk = process.env.KLING_SECRET_KEY!
  return `${ak}:${sk}`
}

const KLING_BASE_URL = "https://api.klingai.com/v1"

export async function createImageToVideo(params: {
  imageUrl: string
  prompt: string
  duration?: number
  aspectRatio?: string
}) {
  const auth = getKlingAuth()
  
  const res = await fetch(`${KLING_BASE_URL}/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({
      model_name: "kling-v2",
      image: params.imageUrl,
      prompt: params.prompt,
      duration: params.duration || 5,
      aspect_ratio: params.aspectRatio || "16:9",
      mode: "std",
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Kling API error: ${res.status} - ${error}`)
  }

  return res.json()
}

export async function getVideoStatus(taskId: string) {
  const auth = getKlingAuth()

  const res = await fetch(`${KLING_BASE_URL}/videos/image2video/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth}`,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Kling API error: ${res.status} - ${error}`)
  }

  return res.json()
}
