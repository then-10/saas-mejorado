import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/expire-layaways
 * Header requerido: x-cron-secret: <CRON_SECRET>
 *
 * Marca como EXPIRED los apartados ACTIVE vencidos, expira su orden y
 * DEVUELVE EL STOCK de los artículos. Política del anticipo: se retiene
 * (queda registrado en paidAmount); la devolución, si aplica, es decisión
 * manual del dueño desde el panel.
 *
 * Pensado para dispararse cada hora con el cron de Railway o un scheduler
 * externo (cron-job.org, EasyCron) apuntando a esta URL.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const expired = await prisma.layaway.findMany({
    where: {
      status: "ACTIVE",
      dueDate: { lt: now },
      order: { status: "PENDING_PAYMENT" },
    },
    include: { order: { include: { items: true } } },
    take: 100, // lotes acotados; el siguiente tick procesa el resto
  });

  let processed = 0;
  for (const layaway of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.layaway.update({
          where: { id: layaway.id },
          data: { status: "EXPIRED" },
        });
        await tx.order.update({
          where: { id: layaway.orderId },
          data: { status: "EXPIRED" },
        });
        // Devolver stock de cada artículo
        for (const item of layaway.order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      });
      processed++;
    } catch {
      // Un apartado fallido no detiene el lote; se reintenta en el siguiente tick
    }
  }

  return NextResponse.json({ ok: true, expired: processed, found: expired.length });
}

// GET de cortesía para probar conectividad del scheduler (mismo secreto)
export async function GET(req: NextRequest) {
  return POST(req);
}
