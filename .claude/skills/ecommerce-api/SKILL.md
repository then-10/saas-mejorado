---
name: ecommerce-api
description: Mapa del módulo e-commerce multi-tenant del SaaS (modelos, endpoints, auth, pagos). Se activa al trabajar con /api/shop, /api/admin/shop, productos, pedidos, pagos, apartados, X-Tenant-Key o la app TiendaRopa.
---

# Skill: Módulo E-commerce — saas-mejorado

Backend del e-commerce que consume la app Android **TiendaRopa** (repo
`then-10/tiendaropa-android`). Vive íntegro en `admin-panel/`.

## Mapa del módulo
```
admin-panel/
├── prisma/schema.prisma          # + modelos: Store, Product, Customer, Order,
│                                 #   OrderItem, Payment, Layaway (F1)
├── prisma/seed-shop.ts           # Tienda demo + 8 productos; imprime X-Tenant-Key
└── src/
    ├── lib/shop/
    │   ├── tenant.ts             # resolveStore(req) ← header X-Tenant-Key
    │   ├── customer-auth.ts      # JWT jose HS256 30d (SHOP_JWT_SECRET)
    │   ├── serialize.ts          # Prisma.Decimal → Number
    │   └── payments/             # F3: PaymentProvider + adapters MP/Conekta
    │       ├── PaymentProvider.ts, MercadoPagoAdapter.ts, ConektaAdapter.ts
    │       ├── getPaymentProvider.ts   # factory por tienda
    │       └── encryption.ts           # AES-256-GCM (CIPHER_MASTER_KEY)
    └── app/
        ├── api/shop/             # API del CLIENTE FINAL (X-Tenant-Key)
        │   ├── auth/{register,login}/  # bcrypt + JWT
        │   ├── products/ y products/[id]/   # ?updatedAfter= → sync incremental
        │   └── orders/ ...       # crear/listar pedidos, pagos por pedido
        ├── api/admin/shop/       # API del DUEÑO (sesión NextAuth)
        │   ├── stores/           # activa e-commerce, genera tk_...
        │   ├── products/ ...     # CRUD (PUT toca updatedAt → sync en app)
        │   └── orders/ ...       # filtros, cambio de estado, pago en efectivo
        └── webhook/{mercadopago,conekta}/  # firma verificada + idempotencia
```

## Invariantes de seguridad (no negociables)
1. `storeId` SIEMPRE desde `resolveStore(req)`; `customerId` SIEMPRE del JWT.
2. Precios/totales calculados en servidor; la app solo manda `productId+quantity`.
3. Stock: `updateMany WHERE stock >= quantity` en `$transaction` → 409 si falla.
4. Soft delete de productos (`isActive=false`).
5. Webhooks: verificar firma → idempotencia por `externalId` → 200.
6. Llaves de pago cifradas en BD; descifrar solo con `decryptField` server-side.
7. `Decimal` → `Number` con `serialize.ts` antes de todo JSON.

## Flujo de pago (F3)
```
App: POST /api/shop/orders             → crea pedido PENDING_PAYMENT
App: POST /api/shop/orders/:id/payments {method} →
     CARD → checkoutUrl (Custom Tab + polling GET ?paymentId=)
     SPEI → reference (CLABE)   |   CASH_OXXO → barcodeUrl + reference
     CASH_IN_STORE → solo registro, el dueño confirma desde el panel
Proveedor → /webhook/{mp|conekta}      → Payment PAID + Order PAID
```

## Probar en local
```bash
cd admin-panel && npm run dev    # puerto 3001
TK="tk_...del seed"
curl -s localhost:3001/api/shop/products -H "X-Tenant-Key: $TK"
curl -s -X POST localhost:3001/api/shop/auth/login -H "X-Tenant-Key: $TK" \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@test.mx","password":"password123"}'   # → { token }
```

## Estado por fases
- F1 (modelos+endpoints) ✅ en main · F3 (pagos) y F4 (auth+apartados+notifs):
  verificar rama/PR antes de asumir — consultar PROGRESS/docs del repo TiendaRopa.
