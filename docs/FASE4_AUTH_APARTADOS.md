# Fase 4 — Auth de clientes y apartados con abonos

## Lo que entrega
- Los clientes finales de cada tienda tienen **su propia cuenta** (registro/login
  con email y password), aislada por tienda.
- Los apartados (`type: "LAYAWAY"`) admiten **abonos parciales** vía Mercado Pago,
  Conekta o en efectivo (registrado por el dueño desde el panel).
- La aplicación de pagos es **idempotente** y **consciente del tipo de pedido**:
  un webhook que llegue dos veces no duplica el abono; un abono parcial no marca
  la orden como pagada hasta cubrir el total.

## Auth de clientes

### Aislamiento
- Cada `Customer` pertenece a una `Store` (`unique([storeId, email])`). El mismo
  email puede existir en dos tiendas distintas como cuentas independientes.
- El JWT se firma con **`SHOP_JWT_SECRET`** (distinto de `NEXTAUTH_SECRET`,
  que es para admins). Algoritmo HS256, expiración 30 días, payload con
  `sub` (customerId) y `storeId`.

### Endpoints

```bash
# Registro
curl -X POST https://<host>/api/shop/auth/register \
  -H "X-Tenant-Key: tk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana","email":"ana@example.com","password":"secret123","phone":"+52..."}'
# → 201 { token: "...", customer: { id, name, email, phone } }
# → 409 si el email ya existe en esa tienda

# Login
curl -X POST https://<host>/api/shop/auth/login \
  -H "X-Tenant-Key: tk_..." \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"secret123"}'

# Perfil
curl https://<host>/api/shop/me \
  -H "X-Tenant-Key: tk_..." -H "Authorization: Bearer $TOKEN"
```

### Almacenamiento del token en la app
- En `EncryptedSharedPreferences` (`TokenStorage` en el repo Android), cifrado
  en reposo con Android Keystore. NUNCA en SharedPreferences plano.
- El `AuthInterceptor` lo agrega como `Authorization: Bearer` solo cuando existe;
  los endpoints públicos (catálogo) siguen funcionando sin token.

## Apartados con abonos

### Modelo
```
Order { type=LAYAWAY, status=PENDING_PAYMENT, total }
  └─ Layaway { depositAmount, paidAmount, dueDate, status: ACTIVE|COMPLETED|EXPIRED|CANCELLED }
```
Cuando se crea un pedido `LAYAWAY`:
- `depositAmount = total * store.layawayDepositPct / 100` (% configurable en `/admin/tiendas/[id]/configuracion`).
- `dueDate = createdAt + store.layawayDays` (días configurables).
- `paidAmount` arranca en 0; sube con cada pago confirmado.

### Flujo del primer pago (anticipo)
```
App → POST /api/shop/orders { type: LAYAWAY, items, shippingInfo }
                                         → crea pedido + layaway
App → POST /api/shop/orders/:id/payments { method }
                                         → cobra DEPÓSITO (depositAmount)
                                         → método decide formato:
                                            CARD → checkoutUrl
                                            SPEI → reference (CLABE)
                                            CASH_OXXO → barcodeUrl
                                            CASH_IN_STORE → registro (dueño confirma)
```
Si ya se cobró el anticipo, este endpoint responde `422` ("usa el endpoint de
abonos del apartado").

### Flujo de los abonos siguientes
```
App → POST /api/shop/layaways/:id/payments { method, amount }
                                         → valida amount > 0 y ≤ restante,
                                           valida no vencido, crea Payment PENDING
                                         → devuelve checkoutUrl / reference
```
Cuando el proveedor confirma (vía webhook) o el polling lo detecta:
```
applyPaidPayment(paymentId)   ← compartido por webhooks y polling
  ├─ claim atómico (updateMany WHERE status != PAID)
  ├─ si LAYAWAY:
  │    paidAmount += amount
  │    if paidAmount >= order.total:
  │       layaway.status = COMPLETED
  │       order.status   = PAID
  └─ si PURCHASE:
       order.status = PAID
  └─ notifyOwnerOfSale (Telegram/WhatsApp si está configurado)
```

### Abonos en efectivo (registra el dueño)
Desde `/admin/tiendas/[id]/pedidos/[orderId]` el botón "Abono en efectivo"
llama a `POST /api/admin/shop/orders/[id]/payments/cash { amount }`. El endpoint
también delega en `applyPaidPayment`, por lo que el progreso del apartado avanza
igual que si fuera un pago electrónico.

### Expiración
Apartados `ACTIVE` con `dueDate < now()` los expira el cron
`/api/cron/expire-layaways` (header `x-cron-secret`):
- `layaway.status = EXPIRED`, `order.status = EXPIRED`.
- Se **devuelve el stock** (decremento se revierte con `increment`).
- El **anticipo se retiene** en `paidAmount`; el dueño decide si lo
  reembolsa manualmente desde el panel.

Configurar el scheduler de Railway (o `cron-job.org`, EasyCron) para pegar
**cada hora** a esta URL con el header del secreto.

## Garantías y casos límite probados
| Caso | Comportamiento |
|---|---|
| Webhook y polling confirman el mismo pago | Se aplica una sola vez (claim atómico) |
| Cliente intenta abonar más que el restante | `422` con monto restante exacto |
| Cliente abona después de `dueDate` | `422` ("el apartado está vencido") |
| Webhook llega después de expirar el apartado | Se aplica de todos modos al `Payment`; el orden ya está `EXPIRED` y no cambia (el flujo "completar" verifica `status` antes de mover) |
| Cliente registra otro email en la misma tienda | `409` (unique storeId+email) |
| Cliente registra el mismo email en otra tienda | OK — son cuentas independientes |

## App Android (resumen del lado cliente)
- `LoginScreen` / `RegisterScreen` (con sus ViewModels en `ui/auth/`).
- `ProfileScreen` — muestra estado de sesión y atajo a "Mis apartados".
- `OrdersScreen` (tab del BottomBar) — lista los pedidos con etiquetas en ES.
- `LayawaysScreen` — barra de progreso por apartado y diálogo de abono
  (monto + método).
- `LayawayPaymentScreen` — abre Custom Tab para `CARD`, muestra `reference`
  para `SPEI`/`CASH_OXXO`, hace polling acotado (5 s × 60 intentos) contra
  `verifyPaymentStatus`, y al confirmar regresa a `LayawaysScreen`.

## Reglas de oro (no negociables)
1. **`SHOP_JWT_SECRET` ≠ `NEXTAUTH_SECRET`**, ambos generados con
   `openssl rand -hex 32`. Ninguno con default de desarrollo en producción.
2. **El monto jamás viaja desde la app** en los endpoints de pedido — el server
   calcula con precios de la BD. En el endpoint de abonos el `amount` sí viene
   del cliente pero se valida contra el restante.
3. **`applyPaidPayment` es el único camino** para marcar un pago como `PAID`.
   Cualquier otra ruta que actualice estado de pago es un bug.
