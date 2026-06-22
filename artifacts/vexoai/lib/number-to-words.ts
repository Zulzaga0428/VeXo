// Converts digits in text to spoken Mongolian words so TTS reads "12" as
// "арван хоёр" instead of skipping/garbling it. camb.ai's Mongolian voices
// don't reliably read raw numerals, so we expand them before synthesis.

// Standalone forms (used at the very end of a number).
const ONES = ["", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"]
// Combining forms (used when another number word follows).
const ONES_C = ["", "нэг", "хоёр", "гурван", "дөрвөн", "таван", "зургаан", "долоон", "найман", "есөн"]
const TENS = ["", "арав", "хорь", "гуч", "дөч", "тавь", "жар", "дал", "ная", "ер"]
const TENS_C = ["", "арван", "хорин", "гучин", "дөчин", "тавин", "жаран", "далан", "наян", "ерэн"]

// Convert a 1..999 group. `more` = whether any number word follows this group.
function group(n: number, more: boolean): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rem = n % 100
  const t = Math.floor(rem / 10)
  const o = rem % 10

  if (h > 0) {
    const followed = rem > 0 || more
    parts.push(`${ONES_C[h]} ${followed ? "зуун" : "зуу"}`)
  }
  if (t > 0) {
    const followed = o > 0 || more
    parts.push(followed ? TENS_C[t] : TENS[t])
  }
  if (o > 0) {
    parts.push(more ? ONES_C[o] : ONES[o])
  }
  return parts.join(" ")
}

// Convert a non-negative integer to Mongolian words.
function intToMongolian(num: number): string {
  if (num === 0) return "тэг"

  const scales = [
    { div: 1_000_000_000, comb: "тэрбум", std: "тэрбум" },
    { div: 1_000_000, comb: "сая", std: "сая" },
    { div: 1_000, comb: "мянган", std: "мянга" },
  ]

  type Seg = { value: number; comb: string; std: string }
  const segs: Seg[] = []
  let rest = num
  for (const s of scales) {
    const q = Math.floor(rest / s.div)
    rest %= s.div
    if (q > 0) segs.push({ value: q, comb: s.comb, std: s.std })
  }
  const last = rest // 0..999

  const words: string[] = []
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    // Anything non-zero after this segment?
    const laterExist = segs.slice(i + 1).some((x) => x.value > 0) || last > 0
    // The group is always followed by its scale word, so use combining form.
    words.push(group(seg.value, true))
    words.push(laterExist ? seg.comb : seg.std)
  }
  if (last > 0) {
    words.push(group(last, false))
  }
  return words.join(" ")
}

// Read a number string (may contain a decimal point) as Mongolian words.
function numberToMongolian(raw: string): string {
  const clean = raw.replace(/,/g, "")
  if (clean.includes(".")) {
    const [intPart, fracPart] = clean.split(".")
    const intWords = intToMongolian(Number(intPart) || 0)
    // Read fractional digits one by one: "цэг тав долоо"
    const fracWords = fracPart
      .split("")
      .map((d) => ONES[Number(d)] || "тэг")
      .join(" ")
    return `${intWords} цэг ${fracWords}`
  }
  // Guard against absurdly large numbers (beyond what we model): read as-is.
  const n = Number(clean)
  if (!Number.isFinite(n) || n > 999_999_999_999) {
    return clean
      .split("")
      .map((d) => ONES[Number(d)] || "тэг")
      .join(" ")
  }
  return intToMongolian(n)
}

// Replace every run of digits in `text` with its spoken Mongolian form.
// Keeps surrounding punctuation/words intact. Handles commas and decimals.
export function expandNumbersToMongolian(text: string): string {
  if (!text) return text
  return text.replace(/\d[\d,]*(\.\d+)?/g, (match) => numberToMongolian(match))
}
