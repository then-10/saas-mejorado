import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// In-memory daily counter — resets with each deploy.
// For production at scale, move this to Redis.
const dailyUsage = new Map<string, { count: number; date: string }>()

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function getUsage(clientId: string, today: string): number {
  const entry = dailyUsage.get(clientId)
  if (!entry || entry.date !== today) return 0
  return entry.count
}

// Returns the new count after increment.
function incrementUsage(clientId: string, today: string): number {
  const current = dailyUsage.get(clientId)
  const newCount = (!current || current.date !== today) ? 1 : current.count + 1
  dailyUsage.set(clientId, { count: newCount, date: today })
  return newCount
}

function isAuthorized(req: NextRequest): boolean {
  // Bot-to-server calls use a shared secret in the Authorization header.
  const botSecret = process.env.BOT_API_SECRET
  if (botSecret) {
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader === `Bearer ${botSecret}`) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  // Accept either an authenticated admin session or the bot shared secret.
  const session = await getServerSession(authOptions)
  if (!session && !isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

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

  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt.length < 3) {
    return NextResponse.json({ error: 'El prompt es demasiado corto' }, { status: 400 })
  }

  if (trimmedPrompt.length > 4000) {
    return NextResponse.json({ error: 'El prompt es demasiado largo (máx 4000 caracteres)' }, { status: 400 })
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

  // Parse daily limit — guard against NaN (e.g. empty string from a stale config row)
  const rawLimit = parseInt(config['daily_limit'] ?? '10', 10)
  const dailyLimit = isNaN(rawLimit) ? 10 : rawLimit

  const size = (config['default_size'] ?? '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792'
  const quality = (config['default_quality'] ?? 'standard') as 'standard' | 'hd'
  const style = (config['style_preset'] ?? 'vivid') as 'vivid' | 'natural'
  const systemContext = config['system_context'] ?? ''
  const watermark = config['watermark_text'] ?? ''

  const today = getTodayKey()

  // Atomic check-and-increment: both run synchronously before any await,
  // so concurrent requests in the same Node.js process cannot both pass.
  if (dailyLimit > 0 && getUsage(clientId, today) >= dailyLimit) {
    const limitMsg = config['limit_reached_message'] ?? 'Límite diario de imágenes alcanzado.'
    return NextResponse.json({ error: limitMsg, limitReached: true }, { status: 429 })
  }
  // Increment now — before the async DALL-E call — to hold the slot.
  const usageAfter = incrementUsage(clientId, today)

  // Build the final prompt — strip quotes from watermark to prevent prompt injection
  const safeWatermark = watermark.replace(/["']/g, '')
  const parts: string[] = []
  if (systemContext) parts.push(systemContext)
  parts.push(trimmedPrompt)
  if (safeWatermark) {
    parts.push(`Include the text "${safeWatermark}" subtly in the image as a watermark or brand element.`)
  }
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

  // Log generation in ActivityLog — awaited so the write completes before the response.
  await prisma.activityLog.create({
    data: {
      action: `Imagen generada vía ${channel}`,
      entityType: 'Client',
      entityId: clientId,
      details: `Prompt: "${trimmedPrompt.slice(0, 100)}" | Size: ${size} | Quality: ${quality}`,
    },
  }).catch((err) => console.error('ActivityLog write failed:', err))

  return NextResponse.json({
    imageUrl,
    prompt: finalPrompt,
    size,
    quality,
    usageToday: usageAfter,
    dailyLimit,
  })
}

// GET: return usage stats for a client (admin use — requires session or bot secret)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session && !isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

  const today = getTodayKey()
  return NextResponse.json({
    usageToday: getUsage(clientId, today),
    date: today,
  })
}
