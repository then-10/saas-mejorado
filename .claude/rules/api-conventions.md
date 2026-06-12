# Convenciones de API — saas-mejorado (admin-panel)

El código funcional vive en `admin-panel/` (Next.js 14 App Router). Las rutas son
route handlers en `admin-panel/src/app/api/**/route.ts` — NO Express, NO `/api/v1`.

## Dos superficies de API

| Superficie | Prefijo | Auth | Consumidor |
|---|---|---|---|
| Tienda (cliente final) | `/api/shop/*` | Header `X-Tenant-Key` + `Authorization: Bearer <JWT jose>` donde aplique | App Android TiendaRopa |
| Admin (dueño/panel) | `/api/admin/shop/*` | Sesión NextAuth (`getServerSession`) | Dashboard web |
| Webhooks de pago | `/webhook/mercadopago`, `/webhook/conekta` | Firma criptográfica (sin sesión) | Proveedores |

## Resolución de tenant
- Toda ruta `/api/shop/*` inicia con `resolveStore(req)` (lee `X-Tenant-Key`).
- Si no resuelve → `unauthorizedTenant()` (401). Cliente `SUSPENDIDO` → rechazado.
- `storeId` y `customerId` NUNCA se aceptan desde params/body del cliente.

## Formato de respuesta
Objetos JSON planos por recurso (sin envelope `{success,data}`):
```json
{ "products": [...], "serverTime": "2026-06-10T00:00:00Z" }
{ "order": { ... } }
{ "error": "Mensaje legible" }   // siempre acompañado del status HTTP correcto
```
- `Prisma.Decimal` → `Number` vía `src/lib/shop/serialize.ts` antes de responder.
- Sync incremental: listados aceptan `?updatedAfter=ISO8601` y devuelven `serverTime`.

## Códigos de estado
| Situación | Código |
|---|---|
| Lectura/actualización OK | 200 |
| Creación | 201 |
| Body inválido | 400 |
| Tenant o token inválido | 401 |
| Recurso de otro tenant / rol incorrecto | 404 (no revelar existencia) |
| Stock insuficiente / conflicto | 409 |
| Estado no permite la operación | 422 |
| Error del proveedor de pagos | 502 |

## Reglas de dominio
- Precios y totales SIEMPRE calculados en servidor.
- Stock: `updateMany WHERE stock >= quantity` dentro de `$transaction`.
- Productos: soft delete (`isActive=false`).
- Estados de pedido: transiciones validadas contra el mapa `TRANSITIONS`.
- Webhooks: verificar firma → procesar idempotente (por `externalId`) → responder 200.

## Aplica a
`admin-panel/src/app/api/**/route.ts`, `admin-panel/src/lib/shop/**`
