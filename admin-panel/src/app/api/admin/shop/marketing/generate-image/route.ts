import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'
import {
  getDailyUsage,
  incrementDailyUsage,
  getTodayKey,
  generateImageWithDalle,
  type DalleSize,
  type DalleQuality,
  type DalleStyle,
} from '@/lib/shop/image-gen'

/**
 * POST /api/admin/shop/marketing/generate-image — body: { productId, prompt? }
 *
 * Genera una imagen con DALL-E 3 para un producto del catálogo, usando el
 * mismo feature/config ('generacion_imagenes') que ya administra el SaaS
 * para los bots de Telegram/WhatsApp — el cupo diario se comparte entre
 * ambos canales porque representa el mismo costo de OpenAI.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { productId?: string; prompt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { productId } = body
  const userPrompt = (body.prompt ?? '').trim()
  if (!productId) return NextResponse.json({ error: 'productId es requerido' }, { status: 400 })

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || !canAccessStore(session, product.storeId)) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const store = await prisma.store.findUnique({ where: { id: product.storeId } })
  if (!store) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const apiKey = process.env.IMAGE_GEN_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Servicio de imágenes no configurado. Contacta al administrador.' },
      { status: 503 }
    )
  }

  const feature = await prisma.clientFeature.findUnique({
    where: { clientId_featureKey: { clientId: store.clientId, featureKey: 'generacion_imagenes' } },
    include: { client: { include: { config: true } } },
  })
  if (!feature?.enabled) {
    return NextResponse.json(
      { error: 'La Generación de Imágenes IA no está activa para esta tienda.' },
      { status: 403 }
    )
  }

  const allConfig = (feature.client.config?.config ?? {}) as Record<string, Record<string, string>>
  const config = allConfig['generacion_imagenes'] ?? {}

  const rawLimit = parseInt(config['daily_limit'] ?? '10', 10)
  const dailyLimit = isNaN(rawLimit) ? 10 : rawLimit
  const size = (config['default_size'] ?? '1024x1024') as DalleSize
  const quality = (config['default_quality'] ?? 'standard') as DalleQuality
  const style = (config['style_preset'] ?? 'vivid') as DalleStyle
  const systemContext = config['system_context'] ?? ''
  const watermark = config['watermark_text'] ?? ''

  const today = getTodayKey()
  if (dailyLimit > 0 && getDailyUsage(store.clientId, today) >= dailyLimit) {
    const limitMsg = config['limit_reached_message'] ?? 'Límite diario de imágenes alcanzado.'
    return NextResponse.json({ error: limitMsg, limitReached: true }, { status: 429 })
  }
  const usageAfter = incrementDailyUsage(store.clientId, today)

  const safeWatermark = watermark.replace(/["']/g, '')
  const parts: string[] = []
  if (systemContext) parts.push(systemContext)
  parts.push(`Producto: "${product.name}". ${product.description}`.trim())
  if (userPrompt) parts.push(userPrompt)
  if (safeWatermark) {
    parts.push(`Include the text "${safeWatermark}" subtly in the image as a watermark or brand element.`)
  }
  const finalPrompt = parts.join('. ')

  let imageUrl: string
  try {
    imageUrl = await generateImageWithDalle({ apiKey, prompt: finalPrompt, size, quality, style })
  } catch (err) {
    console.error('Image generation error:', err)
    return NextResponse.json(
      { error: config['error_message'] ?? 'No se pudo generar la imagen. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  await prisma.activityLog
    .create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: 'Imagen generada vía app TiendaRopa',
        entityType: 'Product',
        entityId: productId,
        details: `Producto: "${product.name}" | Size: ${size} | Quality: ${quality}`,
      },
    })
    .catch((err) => console.error('ActivityLog write failed:', err))

  return NextResponse.json({
    imageUrl,
    usageToday: usageAfter,
    dailyLimit,
  })
}
