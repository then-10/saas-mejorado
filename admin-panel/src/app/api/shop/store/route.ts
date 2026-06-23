import { NextRequest, NextResponse } from "next/server";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";

/**
 * GET /api/shop/store
 * Configuración pública de la tienda para la app Android (no requiere sesión
 * de cliente, solo X-Tenant-Key). Por ahora solo expone flags de features
 * controladas por el dueño del SaaS.
 */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();

  return NextResponse.json({
    iaMarketingEnabled: store.iaMarketingEnabled,
  });
}
