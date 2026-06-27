import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

const SYSTEM_PROMPT = `
Eres un experto en marketing digital de moda latinoamericana con 10 años de experiencia
creando contenido viral para Instagram, TikTok y Facebook.

Analiza la prenda de ropa en la imagen (color, tipo, estilo, ocasión de uso) y el nombre
del producto, y genera exactamente 3 propuestas de copy publicitario optimizadas: una por
plataforma.

Reglas para cada copy:
- hook: gancho de venta de máximo 10 palabras, impactante y directo
- body: cuerpo del texto de 2-4 oraciones con emojis relevantes incluidos
- hashtags: lista de 6-8 hashtags populares mezclando español e inglés (#moda, #fashion, etc.)
- Tono energético, aspiracional, dirigido a jóvenes de 18-35 años de LATAM

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código markdown.
Estructura exacta requerida:
{
  "copies": [
    { "platform": "Instagram", "hook": "...", "body": "...", "hashtags": ["#...", "..."] },
    { "platform": "TikTok",    "hook": "...", "body": "...", "hashtags": ["#...", "..."] },
    { "platform": "Facebook",  "hook": "...", "body": "...", "hashtags": ["#...", "..."] }
  ]
}
`.trim()

interface GeminiCopy {
  platform: string
  hook: string
  body: string
  hashtags: string[]
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15000

function isGeminiCopy(v: unknown): v is GeminiCopy {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.platform === 'string' &&
    typeof c.hook === 'string' &&
    typeof c.body === 'string' &&
    Array.isArray(c.hashtags) &&
    c.hashtags.every((h) => typeof h === 'string')
  )
}

/** Solo permite descargar imágenes https de un host público (bloquea SSRF a redes internas/metadata). */
function isSafeImageUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '169.254.169.254' ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === '::1'
  ) {
    return false
  }
  return true
}

/** POST /api/admin/shop/marketing/generate-copy — body: { productId } */
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { productId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { productId } = body
  if (!productId) return NextResponse.json({ error: 'productId es requerido' }, { status: 400 })

  const product = await prisma.product.findUnique({ where: { id: productId } })
  // 404 en vez de 403: no revelar existencia de un producto de otra tienda.
  if (!product || !canAccessStore(session, product.storeId)) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const store = await prisma.store.findUnique({
    where: { id: product.storeId },
    select: { iaMarketingEnabled: true },
  })
  if (!store?.iaMarketingEnabled) {
    return NextResponse.json(
      { error: 'IA Marketing no está activo en tu plan. Contacta al administrador.' },
      { status: 403 }
    )
  }

  if (!product.imageUrl) {
    return NextResponse.json(
      { error: 'El producto no tiene imagen. Agrega una foto antes de generar copys.' },
      { status: 422 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Servicio de IA Marketing no configurado. Contacta al administrador.' },
      { status: 503 }
    )
  }

  if (!isSafeImageUrl(product.imageUrl)) {
    console.error('imageUrl rechazada por isSafeImageUrl:', product.imageUrl)
    return NextResponse.json(
      { error: 'No se pudo leer la imagen del producto.' },
      { status: 502 }
    )
  }

  let base64Image: string
  let mimeType: string
  try {
    const imageController = new AbortController()
    const imageTimeout = setTimeout(() => imageController.abort(), FETCH_TIMEOUT_MS)
    let imageRes: Response
    try {
      imageRes = await fetch(product.imageUrl, { signal: imageController.signal })
    } finally {
      clearTimeout(imageTimeout)
    }
    if (!imageRes.ok) throw new Error(`status ${imageRes.status}`)
    const contentLength = Number(imageRes.headers.get('content-length') ?? '0')
    if (contentLength > MAX_IMAGE_BYTES) throw new Error('imagen demasiado grande')
    mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await imageRes.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('imagen demasiado grande')
    base64Image = Buffer.from(buffer).toString('base64')
  } catch (err) {
    console.error('No se pudo descargar la imagen del producto:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'No se pudo leer la imagen del producto.' },
      { status: 502 }
    )
  }

  let copies: GeminiCopy[]
  try {
    const geminiController = new AbortController()
    const geminiTimeout = setTimeout(() => geminiController.abort(), FETCH_TIMEOUT_MS)
    let geminiRes: Response
    try {
      geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: geminiController.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: base64Image } },
                  { text: `${SYSTEM_PROMPT}\n\nNombre del producto: "${product.name}"` },
                ],
              },
            ],
            generationConfig: { response_mime_type: 'application/json' },
          }),
        }
      )
    } finally {
      clearTimeout(geminiTimeout)
    }

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}))
      console.error('Gemini error status:', geminiRes.status, JSON.stringify(errBody).slice(0, 500))
      return NextResponse.json(
        { error: 'No se pudieron generar los copys. Intenta de nuevo.' },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!jsonText) throw new Error('Gemini no retornó contenido')

    const parsed = JSON.parse(jsonText) as { copies?: unknown }
    const rawCopies = Array.isArray(parsed.copies) ? parsed.copies : []
    copies = rawCopies.filter(isGeminiCopy)
    if (copies.length === 0) throw new Error('Gemini generó 0 copys válidos')
  } catch (err) {
    console.error('Error generando marketing copy:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Error generando los copys. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  await prisma.activityLog.create({
    data: {
      action: 'IA Marketing: copys generados',
      entityType: 'Product',
      entityId: productId,
      details: `Producto: "${product.name}"`,
    },
  }).catch((err) => console.error('ActivityLog write failed:', err))

  return NextResponse.json({ copies })
}
