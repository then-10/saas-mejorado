// Lógica compartida de generación de imágenes con DALL-E 3, usada tanto por
// el bot (Telegram/WhatsApp, /api/image-gen) como por la app TiendaRopa
// (/api/admin/shop/marketing/generate-image). El cupo diario se comparte por
// clientId entre ambos canales porque representa el mismo costo de OpenAI.

// In-memory daily counter — resets with each deploy.
// For production at scale, move this to Redis.
const dailyUsage = new Map<string, { count: number; date: string }>()

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export function getDailyUsage(clientId: string, today: string): number {
  const entry = dailyUsage.get(clientId)
  if (!entry || entry.date !== today) return 0
  return entry.count
}

// Returns the new count after increment.
export function incrementDailyUsage(clientId: string, today: string): number {
  const current = dailyUsage.get(clientId)
  const newCount = !current || current.date !== today ? 1 : current.count + 1
  dailyUsage.set(clientId, { count: newCount, date: today })
  return newCount
}

export type DalleSize = '1024x1024' | '1792x1024' | '1024x1792'
export type DalleQuality = 'standard' | 'hd'
export type DalleStyle = 'vivid' | 'natural'

export async function generateImageWithDalle(opts: {
  apiKey: string
  prompt: string
  size: DalleSize
  quality: DalleQuality
  style: DalleStyle
}): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: opts.prompt,
      n: 1,
      size: opts.size,
      quality: opts.quality,
      style: opts.style,
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    console.error('OpenAI error:', errBody)
    throw new Error(`OpenAI respondió ${res.status}`)
  }

  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in response')
  return imageUrl
}
