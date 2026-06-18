# API Reference — Módulo E-commerce

Dos superficies de API + webhooks + cron. Todas las rutas viven en
`admin-panel/src/app/**/route.ts` (App Router, no Express).

## Convenciones globales
- Respuesta normal: `200` / `201`. Errores: `{ "error": "mensaje legible" }`.
- Todo `Prisma.Decimal` se serializa a `Number` (vía `src/lib/shop/serialize.ts`)
  antes de salir como JSON.
- Fechas en ISO 8601 (UTC).
- `Idempotency`: los webhooks y el polling son **idempotentes** por
  `externalId` / `applyPaidPayment` — el mismo evento llegado dos veces no
  duplica nada.

---

## 1) Superficie pública — `/api/shop/*` (consumida por la app Android)

**Headers requeridos:**
- `X-Tenant-Key: tk_...` siempre.
- `Authorization: Bearer <JWT jose>` para endpoints autenticados (marcados 🔒).

### Auth

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| `POST` | `/api/shop/auth/register` | `{ name, email, password (≥8), phone? }` | `201` `{ token, customer }` · `409` si email existe |
| `POST` | `/api/shop/auth/login` | `{ email, password }` | `200` `{ token, customer }` · `401` credenciales |
| `GET`  🔒 | `/api/shop/me` | — | `{ customer: { id, name, email, phone } }` |

### Catálogo (público con `X-Tenant-Key`)

```bash
# Sync incremental (la app pasa el serverTime que recibió la última vez)
curl https://<host>/api/shop/products?updatedAfter=2026-06-12T10:00:00Z \
  -H "X-Tenant-Key: tk_..."
# → { "products": [...], "serverTime": "2026-06-13T..." }
# products incluye items con isActive:false → la app los borra de Room

# Detalle (stock/precio frescos para el cliente)
curl https://<host>/api/shop/products/<productId> -H "X-Tenant-Key: tk_..."
# → { "product": { ... } }
```

### Pedidos 🔒

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/api/shop/orders` | Body: `{ type: "PURCHASE"\|"LAYAWAY", items: [{ productId, quantity, size? }], shippingInfo: { mode: "PICKUP"\|"ADDRESS", address?, phone? } }`. El servidor calcula precios/total. `409` si no hay stock. |
| `GET`  | `/api/shop/orders` | `{ orders: [...] }` (incluye `layaway` cuando aplica) |
| `GET`  | `/api/shop/orders/[id]` | Detalle |
| `POST` | `/api/shop/orders/[id]/payments` | Body: `{ method: "CARD"\|"SPEI"\|"CASH_OXXO"\|"CASH_IN_STORE" }`. Devuelve `checkoutUrl` (CARD), `reference` (SPEI), `barcodeUrl` (OXXO). En LAYAWAY cobra el **anticipo**. |
| `GET`  | `/api/shop/orders/[id]/payments?paymentId=...` | Polling de verificación. Internamente delega en `applyPaidPayment` (idempotente). |

### Apartados 🔒

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/shop/layaways` | Lista de apartados del cliente (con `paidAmount`, `dueDate`, `status`, `order`). |
| `POST` | `/api/shop/layaways/[id]/payments` | Body: `{ method: "CARD"\|"SPEI"\|"CASH_OXXO", amount }`. Crea un abono. `422` si excede el restante o está vencido/no ACTIVE. |

---

## 2) Superficie de administración — `/api/admin/shop/*` (consumida por el panel web)

**Auth:** sesión NextAuth (`getServerSession`). Sin sesión → `401`.
Todas las queries reciben/derivan `storeId` para filtrar.

### Tiendas

| Método | Ruta | Notas |
|---|---|---|
| `GET`  | `/api/admin/shop/stores` | Lista tiendas |
| `POST` | `/api/admin/shop/stores` | Activa el módulo para un cliente (genera `tk_...`) |
| `GET`  | `/api/admin/shop/stores/[id]` | Detalle (con `hasMpKey`/`hasConektaKey` booleans; nunca las llaves) |
| `PUT`  | `/api/admin/shop/stores/[id]` | Body: `{ name?, paymentProvider?, layawayDepositPct? (10-100), layawayDays? (7-90), address?, mpAccessToken?, conektaKey? }`. Las llaves se cifran con `encryptField` antes de guardar. |

### Pedidos

| Método | Ruta | Notas |
|---|---|---|
| `GET`   | `/api/admin/shop/orders?storeId=...&status=...&type=...` | Lista filtrable |
| `PATCH` | `/api/admin/shop/orders/[id]/status` | Body: `{ status }`. Solo transiciones permitidas por el mapa `TRANSITIONS` (`PENDING_PAYMENT → CANCELLED\|EXPIRED`, `PAID → PREPARING\|CANCELLED`, etc.). |
| `POST`  | `/api/admin/shop/orders/[id]/payments/cash` | Body: `{ amount }`. Registra un pago/abono en efectivo (consciente de apartado). |

### Productos

| Método | Ruta | Notas |
|---|---|---|
| `GET`    | `/api/admin/shop/products?storeId=...` | Lista (todos, activos e inactivos) |
| `POST`   | `/api/admin/shop/products` | Body: `{ storeId, name, price (>0), description?, imageUrl?, category?, sizes?: [], stock?: int≥0, isActive? }` |
| `PUT`    | `/api/admin/shop/products/[id]` | Update parcial. Tocar el producto **actualiza `updatedAt`** → la app lo sincroniza en el siguiente tick. |
| `DELETE` | `/api/admin/shop/products/[id]` | Soft delete (`isActive=false`). NUNCA hard delete (integridad con pedidos). |

---

## 3) Webhooks de pagos (sin sesión, firma criptográfica)

| Proveedor | URL a registrar | Header | Secret |
|---|---|---|---|
| Mercado Pago | `https://<host>/webhook/mercadopago` | `x-signature`, `x-request-id` | `MERCADO_PAGO_WEBHOOK_SECRET` |
| Conekta | `https://<host>/webhook/conekta` | `digest` (HMAC-SHA256) | `CONEKTA_WEBHOOK_SECRET` |

Flujo: verificar firma → llamar `applyPaidPaymentByExternalId(externalId)` →
responder `200`. El handler `applyPaidPayment`:
- Hace **claim atómico** (`updateMany WHERE status != PAID`) — pulsar webhook y polling a la vez no duplica.
- En `PURCHASE` → pasa la orden a `PAID`.
- En `LAYAWAY` → incrementa `layaway.paidAmount` y solo marca `COMPLETED` + orden `PAID` cuando cubre `order.total`.

---

## 4) Cron de expiración de apartados

| Método | Ruta | Header | Notas |
|---|---|---|---|
| `POST`/`GET` | `/api/cron/expire-layaways` | `x-cron-secret: <CRON_SECRET>` | Expira layaways `ACTIVE` vencidos: orden `EXPIRED`, devuelve stock. El anticipo se **retiene** (política manual). Procesa hasta 100 por tick — el siguiente tick toma el resto. |

Configurar en Railway u otro scheduler para correr **cada hora**.

---

## Códigos de estado más usados

| Código | Cuándo |
|---|---|
| `200` | Lectura/actualización OK |
| `201` | Recurso creado |
| `400` | Body inválido |
| `401` | Tenant key o token de cliente inválido |
| `404` | Recurso de otra tienda o inexistente (no revelar) |
| `409` | Conflicto: stock insuficiente o email duplicado |
| `422` | Estado no permite la operación (apartado vencido, transición ilegal, anticipo ya pagado) |
| `502` | Error del proveedor de pago |
