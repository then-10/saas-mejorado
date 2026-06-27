import { NextRequest, NextResponse } from "next/server";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shop/store
 * Configuración pública de la tienda para la app Android (no requiere sesión
 * de cliente, solo X-Tenant-Key). Por ahora solo expone flags de features
 * controladas por el dueño del SaaS.
 */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();

  // imageGenEnabled es independiente de iaMarketingEnabled: vive en el
  // sistema de ClientFeature compartido con los bots de Telegram/WhatsApp,
  // no en Store. Una tienda puede tener una sin la otra.
  const imageFeature = await prisma.clientFeature.findUnique({
    where: { clientId_featureKey: { clientId: store.clientId, featureKey: "generacion_imagenes" } },
  });

  return NextResponse.json({
    iaMarketingEnabled: store.iaMarketingEnabled,
    imageGenEnabled: imageFeature?.enabled ?? false,
  });
}
