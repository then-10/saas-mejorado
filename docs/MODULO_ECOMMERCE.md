# Módulo E-commerce — Visión General

Módulo agregado al SaaS para que cada cliente (tienda) tenga **su propia app
Android (TiendaRopa)** con catálogo, pedidos, pagos y apartados, administrada
desde el panel web del super-admin.

App consumidora: [`then-10/tiendaropa-android`](https://github.com/then-10/tiendaropa-android).

## Estado por fase (✅ en `main`)

| Fase | Qué entrega | Commits clave |
|---|---|---|
| **F1 — Núcleo** | Modelos Prisma del módulo (Store, Product, Customer, Order, OrderItem, Payment, Layaway), endpoints `/api/shop/*` (cliente, header `X-Tenant-Key` + JWT `jose`) y `/api/admin/shop/*` (NextAuth), `seed-shop.ts` con tienda demo. | `f74810f`, `3d2b528` |
| **F3 — Pagos** | Adapters de Mercado Pago y Conekta, `encryption.ts` (AES-256-GCM con `CIPHER_MASTER_KEY`), endpoint crear/verificar pago, webhooks con firma criptográfica e idempotencia, notificación al dueño por Telegram/WhatsApp. | `835eb5c` |
| **F4 — Auth + Apartados** | Auth de clientes (bcrypt + JWT `SHOP_JWT_SECRET`), endpoints `/api/shop/me` y `/api/shop/layaways`, `applyPaidPayment` idempotente y consciente de `LAYAWAY` (compartido por webhooks y polling), abonos del cliente vía `POST /api/shop/layaways/[id]/payments`, cobro de anticipo en pedidos de apartado, `/api/cron/expire-layaways` protegido con `CRON_SECRET`. | `fd87bac`, `58b9e6f` |
| **F5 — Dashboard admin** | Vistas `/admin/tiendas` (selector con KPIs), `/admin/tiendas/[id]` (overview con ingresos 30d), pedidos con filtros y acciones (cambio de estado respetando `TRANSITIONS`, registrar abonos en efectivo), apartados con barra de progreso, productos con editor completo (crear/editar/desactivar), ventas con Recharts (LineChart ingresos por día, PieChart métodos, BarChart top productos), configuración editable de tienda con llaves de pago cifradas. | `206a43d`, `8a6b961` |
| **F5 — White-label Android** | `productFlavors` por tienda (dimensión `tienda`, flavors `generic`+`demo`), `SHOP_BASE_URL`/`SHOP_TENANT_KEY`/`app_name` inyectados por flavor. Docs: `docs/FASE5_WHITELABEL.md` en el repo Android. | (repo android `d867c8b`) |

## Mapa del código (todo vive en `admin-panel/`)

```
admin-panel/
├── prisma/
│   ├── schema.prisma                # + 7 modelos del módulo
│   └── seed-shop.ts                 # Tienda demo + 8 productos
└── src/
    ├── lib/shop/
    │   ├── tenant.ts                # resolveStore(req) ← X-Tenant-Key
    │   ├── customer-auth.ts         # JWT jose HS256 30d (SHOP_JWT_SECRET)
    │   ├── serialize.ts             # Decimal → Number
    │   └── payments/
    │       ├── PaymentProvider.ts   # Contrato común
    │       ├── MercadoPagoAdapter.ts
    │       ├── ConektaAdapter.ts
    │       ├── encryption.ts        # AES-256-GCM (CIPHER_MASTER_KEY)
    │       ├── getPaymentProvider.ts# Factory por tienda
    │       └── applyPaidPayment.ts  # F4 — idempotente, consciente de LAYAWAY
    └── app/
        ├── admin/tiendas/           # F5 — dashboard del módulo
        │   ├── page.tsx                              # Selector
        │   └── [storeId]/
        │       ├── page.tsx                          # Overview + KPIs
        │       ├── pedidos/                          # Lista + detalle + acciones
        │       ├── apartados/                        # Cards con progreso
        │       ├── productos/                        # Lista + editor (nuevo/editar)
        │       ├── ventas/                           # Recharts
        │       └── configuracion/                    # PUT stores/[id]
        ├── api/shop/                # API DEL CLIENTE FINAL (app)
        ├── api/admin/shop/          # API DEL SUPER-ADMIN (NextAuth)
        ├── api/cron/expire-layaways # Tarea programada
        └── webhook/                 # Mercado Pago y Conekta
```

## Variables de entorno

| Variable | Fase | Para |
|---|---|---|
| `DATABASE_URL` | F1 | PostgreSQL (Railway lo inyecta) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | F1 | Sesión del super-admin |
| `SHOP_JWT_SECRET` | F1 | JWT de clientes finales (≠ `NEXTAUTH_SECRET`) |
| `CIPHER_MASTER_KEY` | F3 | 64 hex (32 bytes). Cifra llaves de MP/Conekta en BD |
| `MERCADO_PAGO_WEBHOOK_SECRET` | F3 | Verifica firma de webhooks de MP |
| `CONEKTA_WEBHOOK_SECRET` | F3 | Verifica firma de webhooks de Conekta |
| `NEXT_PUBLIC_BASE_URL` | F3 | back_urls / notification_url para proveedores |
| `CRON_SECRET` | F4 | Header `x-cron-secret` requerido por el endpoint de expiración |
| `TWILIO_*`, `TELEGRAM_BOT_TOKEN` | F4 | Notificación al dueño (opcionales) |

Ver `.env.example` para el listado completo y `.claude/skills/deploy/deploy-config.md`
para la tabla detallada de deploy.

## Documentos complementarios
- **`docs/API.md`** — endpoints, headers, ejemplos curl, códigos de estado.
- **`docs/FASE4_AUTH_APARTADOS.md`** — auth de clientes y semántica de apartados.
- **`docs/FASE5_DASHBOARD_ADMIN.md`** — guía operativa del dashboard.
- **`MANUAL_ADMINISTRADOR.md`** — manual del super-admin (incluye sección "Tiendas").
- **`ESTADO_PROYECTO.md`** — checkpoint actualizado por sesión (estado de hoy).
