import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// In-memory daily counter — resets with each deploy.
// For production at scale, move this to Redis.
const dailyUsage = new Map<string, { count: number; date: string }>()

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function getUsage(clientId: string): number {
  const entry = dailyUsage.get(clientId)
  if (!entry || entry.date !== getTodayKey()) return 0
  return entry.count
}

function incrementUsage(clientId: string): void {
  const today = getTodayKey()
  const current = dailyUsage.get(clientId)
  if (!current || current.date !== today) {
    dailyUsage.set(clientId, { count: 1, date: today })
  } else {
    dailyUsage.set(clientId, { count: current.count + 1, date: today })
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.IMAGE_GEN_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Servicio de imágenes no configurado. Contacta al administrador.' },
      { status: 503 }
    )
  }

  let body: { clientId?: string; prompt?: string; channel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { clientId, prompt, channel = 'telegram' } = body

  if (!clientId || !prompt) {
    return NextResponse.json({ error: 'clientId y prompt son requeridos' }, { status: 400 })
  }

  if (prompt.trim().length < 3) {
    return NextResponse.json({ error: 'El prompt es demasiado corto' }, { status: 400 })
  }

  // Verify client exists and has the feature enabled
  const feature = await prisma.clientFeature.findUnique({
    where: { clientId_featureKey: { clientId, featureKey: 'generacion_imagenes' } },
    include: { client: { include: { config: true } } },
  })

  if (!feature?.enabled) {
    return NextResponse.json(
      { error: 'El cliente no tiene el servicio de Generación de Imágenes activado.' },
      { status: 403 }
    )
  }

  // Load client config for this feature
  const allConfig = (feature.client.config?.config ?? {}) as Record<string, Record<string, string>>
  const config = allConfig['generacion_imagenes'] ?? {}

  const dailyLimit = parseInt(config['daily_limit'] ?? '10', 10)
  const size = (config['default_size'] ?? '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792'
  const quality = (config['default_quality'] ?? 'standard') as 'standard' | 'hd'
  const style = (config['style_preset'] ?? 'vivid') as 'vivid' | 'natural'
  const systemContext = config['system_context'] ?? ''
  const watermark = config['watermark_text'] ?? ''

  // Check daily limit
  if (dailyLimit > 0 && getUsage(clientId) >= dailyLimit) {
    const limitMsg = config['limit_reached_message'] ?? 'Límite diario de imágenes alcanzado.'
    return NextResponse.json({ error: limitMsg, limitReached: true }, { status: 429 })
  }

  // Build the final prompt
  const parts: string[] = []
  if (systemContext) parts.push(systemContext)
  parts.push(prompt.trim())
  if (watermark) parts.push(`Include the text "${watermark}" subtly in the image as a watermark or brand element.`)
  const finalPrompt = parts.join('. ')

  // Call OpenAI DALL-E 3
  let imageUrl: string
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size,
        quality,
        style,
      }),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({}))
      console.error('OpenAI error:', errBody)
      return NextResponse.json(
        { error: config['error_message'] ?? 'No se pudo generar la imagen. Intenta con otra descripción.' },
        { status: 502 }
      )
    }

    const openaiData = await openaiRes.json()
    imageUrl = openaiData.data?.[0]?.url
    if (!imageUrl) throw new Error('No image URL in response')
  } catch (err) {
    console.error('Image generation error:', err)
    return NextResponse.json(
      { error: config['error_message'] ?? 'Error generando imagen. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  incrementUsage(clientId)

  // Log generation in ActivityLog
  await prisma.activityLog.create({
    data: {
      action: `Imagen generada vía ${channel}`,
      entityType: 'Client',
      entityId: clientId,
      details: `Prompt: "${prompt.slice(0, 100)}" | Size: ${size} | Quality: ${quality}`,
    },
  }).catch(() => {})

  return NextResponse.json({
    imageUrl,
    prompt: finalPrompt,
    size,
    quality,
    usageToday: getUsage(clientId),
    dailyLimit,
  })
}

// GET: return usage stats for a client (admin use)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  return NextResponse.json({
    usageToday: getUsage(clientId),
    date: getTodayKey(),
  })
}
