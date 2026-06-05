import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.BOT_API_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    include: {
      features: true,
      config: true,
    },
  })

  if (!client) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  if (client.status !== 'ACTIVO' && client.status !== 'PRUEBA') {
    return NextResponse.json({ error: 'Cliente suspendido' }, { status: 403 })
  }

  const featureMap = Object.fromEntries(
    client.features.map((f) => [f.featureKey, f.enabled])
  )

  const allConfig = (client.config?.config ?? {}) as Record<string, Record<string, string>>

  // Only expose keys each bot feature needs — never leak unrelated configs
  const safeConfig: Record<string, Record<string, string>> = {}

  if (allConfig['chatbot_basico']) {
    safeConfig['chatbot_basico'] = {
      welcome_message: allConfig['chatbot_basico']['welcome_message'] ?? '',
      system_prompt: allConfig['chatbot_basico']['system_prompt'] ?? '',
      fallback_message: allConfig['chatbot_basico']['fallback_message'] ?? '',
    }
  }

  if (allConfig['chatbot_ia']) {
    safeConfig['chatbot_ia'] = {
      anthropic_api_key: allConfig['chatbot_ia']['anthropic_api_key'] ?? '',
      business_description: allConfig['chatbot_ia']['business_description'] ?? '',
      system_prompt: allConfig['chatbot_ia']['system_prompt'] ?? '',
      tone: allConfig['chatbot_ia']['tone'] ?? 'amigable',
    }
  }

  if (allConfig['telegram']) {
    safeConfig['telegram'] = {
      bot_token: allConfig['telegram']['bot_token'] ?? '',
      bot_username: allConfig['telegram']['bot_username'] ?? '',
      bot_description: allConfig['telegram']['bot_description'] ?? '',
    }
  }

  if (allConfig['generacion_imagenes']) {
    safeConfig['generacion_imagenes'] = {
      daily_limit: allConfig['generacion_imagenes']['daily_limit'] ?? '10',
      trigger_keywords: allConfig['generacion_imagenes']['trigger_keywords'] ?? '',
      intro_message: allConfig['generacion_imagenes']['intro_message'] ?? '',
      error_message: allConfig['generacion_imagenes']['error_message'] ?? '',
      limit_reached_message: allConfig['generacion_imagenes']['limit_reached_message'] ?? '',
    }
  }

  return NextResponse.json({
    clientId: client.id,
    clientName: client.name,
    features: featureMap,
    config: safeConfig,
  })
}
