# 🧭 ESTADO_PROYECTO.md — Checkpoint de sesión

> **PROTOCOLO OBLIGATORIO PARA CLAUDE (cualquier sesión, humana o agente):**
> 1. **LEER este archivo COMPLETO antes de tocar nada.** Si la sesión se reanudó
>    tras compactación/corte de tokens, NO confiar en la memoria del chat: confiar en git y en este archivo.
> 2. **Auditar git primero** (comandos abajo). Un archivo en el working tree NO es una fase entregada.
> 3. **Actualizar este archivo después de cada paso significativo** (commit, push, merge, decisión)
>    y commitearlo junto con el cambio. Es la última línea de cada commit de trabajo.
> 4. Usar los agentes de `.claude/agents/`: progress-tracker al abrir/cerrar sesión,
>    debugger ante cualquier error (causa raíz primero), code-reviewer antes de commitear.

---

## 📍 Estado actual
- **Fecha:** 2026-06-24 · **Rama:** `main` (commit `abf8f93`). **Nuevo endpoint
  `POST /api/admin/shop/marketing/generate-copy`**: genera 3 copys (Instagram/
  TikTok/Facebook) a partir de la foto de un producto, vía Gemini 1.5 Flash
  server-side (`GEMINI_API_KEY`, nueva var en `.env.example`, AÚN sin valor real
  en Railway — pendiente configurar antes de probar en producción). Gateado por
  `Store.iaMarketingEnabled` (403 si está apagado) y por `canAccessStore()`
  (404 si el producto es de otra tienda). 422 si el producto no tiene
  `imageUrl`. Administración del add-on: el super-admin lo activa/desactiva por
  tienda desde `/admin/tiendas/[storeId]/configuracion` (ya existía, sin
  cambios). Reemplaza, del lado de `tienda-ropa-design`, el placeholder
  "Próximamente" de la pantalla Social por generación real — ver su
  `ESTADO_PROYECTO.md` (commit `f0f7aee`). **Pendiente**: configurar
  `GEMINI_API_KEY` real en Railway y probar el flujo completo en dispositivo.
- **Fecha anterior:** 2026-06-23 · **Rama:** `claude/magical-lamport-4idl8d` (pendiente merge a `main`)
- **Último hito:** Nuevo endpoint `POST /api/admin/shop/customers/:id/payments` para
  cerrar la deuda técnica de "abono a cuenta" documentada en
  `tienda-ropa-design/ESTADO_PROYECTO.md` (Fase 3/4 de ese repo): la app Android no
  tenía forma de registrar en el SaaS un abono entregado por el cliente sin pedido
  asociado. **No requirió migración de schema** — `Payment.orderId` sigue NOT NULL;
  el endpoint reparte el monto recibido entre los pedidos `LAYAWAY` con
  `Layaway.status = ACTIVE` del cliente (más antiguos primero, dentro de un
  `$transaction`), creando un `Payment` real (`CASH_IN_STORE`) por cada pedido
  afectado — mismo criterio que ya usaba el wallet offline de Room en Android
  (`registerAbonoToCuenta`). Si el monto excede la deuda total, el remanente se
  informa en la respuesta como `unapplied` (no existe todavía concepto de "saldo a
  favor del cliente"; si se necesita en el futuro, ahí sí haría falta el campo
  `Customer.creditBalance` + migración). Archivo:
  `admin-panel/src/app/api/admin/shop/customers/[id]/payments/route.ts`. Reusa
  `getAdminSession`/`canAccessStore` de `lib/shop/admin-session.ts` (mismo patrón que
  `orders/[id]/payments/cash/route.ts`). Verificado con `npx tsc --noEmit` (0 errores)
  y `npx prisma validate` (schema válido) tras `npm install` + `npx prisma generate`
  en este sandbox.
- **Hito anterior:** Cierre del gap de enforcement del add-on "App + POS" para el login
  de la app Android (`tiendaropa-android`). El toggle `Store.isActive` ya existía y ya
  se podía desactivar desde el panel (`StoreAddOnCard.tsx`), pero **no bloqueaba nada**
  en el flujo real de login de la app: `lib/auth.ts` (NextAuth `authorize()`) nunca
  comprobaba `Store.isActive`, y `resolveStore()`/`unauthorizedTenant()` solo protegen
  la superficie `/api/shop/*` (cliente final), que esta app NO usa. Se agregó el check
  en `GET /api/admin/shop/stores` (`src/app/api/admin/shop/stores/route.ts`): si quien
  llama es un `Employee` (dueño/staff) y su `Store.isActive=false`, responde
  `403 { error: "STORE_INACTIVE" }`. Este endpoint es el primero que llama la app justo
  después de loguear, por lo que es el choke point correcto sin tocar la respuesta de
  NextAuth. Commit `93cc86a`, pusheado a `claude/magical-lamport-4idl8d` y **ya mergeado
  a `main` vía PR #11** (mergeado externamente, confirmado con
  `git merge-base --is-ancestor`). El flag `Store.iaMarketingEnabled` (ya existente, sin
  cambios de schema) ahora también se consume del lado Android para mostrar/ocultar el
  tab de IA Marketing — ver `ESTADO_PROYECTO.md` de `tiendaropa-android`.
- **Hito anterior:** Add-on "App + POS web" (PR #9, squash `ee7fefa`) + POS embebido en
  panel admin (sesión NextAuth, sin tenant key) MERGEADO y validado con code-review +
  security-audit. Hallazgos corregidos: passwordHash del walk-in customer ya no es
  predecible (era `email+storeId`, ahora `randomBytes(32)`), y la venta admin queda
  registrada en `ActivityLog` (acción `POS_SALE`). `.env.example` corregido — faltaban
  `CIPHER_MASTER_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`, `CONEKTA_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_BASE_URL` (el código ya los exige en runtime, solo no estaban
  documentados). `tsc --noEmit` y `npm run build` limpios tras el merge.
- **Modelo de acceso admin (no es bug, es el diseño actual):** cualquier `AdminUser`
  autenticado (SUPER_ADMIN/ADMIN) puede operar cualquier `Store` — no hay ACL por
  tienda. Es el mismo modelo que ya usan `/api/admin/shop/products`,
  `/api/admin/shop/orders`, etc. desde F5. Si se requiere restringir admins a tiendas
  específicas, es una feature nueva (tabla de asignación admin↔store), no algo que
  arregle este módulo aisladamente.

## ✅ Hecho y verificado (evidencia = commit en main)
| Qué | Evidencia |
|---|---|
| Add-on App+POS mensual (`ClientAddOn`) + POS embebido en admin (`/admin/tiendas/[id]/pos`, sesión NextAuth) + lógica de venta compartida `createPosSale.ts` (usada también por `/api/shop/pos/orders`, empleado+X-Tenant-Key) | PR #9 → `ee7fefa` + merge local `4299098` + fix seguridad (sin commit aparte, mismo merge) |
| F1 — Módulo e-commerce (12 modelos, endpoints shop+admin, multi-tenant X-Tenant-Key, auth clientes login/register con signCustomerToken) | `f74810f` + fix `3d2b528` |
| Fix schema duplicado (¡F1 lo commiteó doble!) validado con getDMMF | `3d2b528` |
| F3 — Pagos backend: adapters MP/Conekta, encryption AES-256-GCM, endpoint crear/verificar pago, webhooks con firma+idempotencia, notificación al dueño (Telegram/WhatsApp por fetch) | `835eb5c` |
| F4 parcial — GET /api/shop/me, GET /api/shop/layaways, serializeLayaway | `fd87bac` |
| F4 backend completa — `applyPaidPayment` idempotente y consciente de LAYAWAY (compartido por webhooks y polling), `POST /api/shop/layaways/[id]/payments` (abono cliente vía MP/Conekta), anticipo cobrado correctamente en pedidos LAYAWAY, `/api/cron/expire-layaways` protegido por `CRON_SECRET` (expira + devuelve stock, anticipo retenido) | `58b9e6f` |
| F4 Android — auth (TokenStorage cifrado + AuthInterceptor), pedidos remotos (ShopOrderRepository + CheckoutViewModel reescrito con orderType PURCHASE/LAYAWAY + gate de sesión), pantallas Login/Register/Profile/Orders/Layaways/LayawayPayment, BottomBar a 4 tabs, security-crypto en gradle | repo android `f6881ee` |
| Fix deploy Railway — `"builder": ""` inválido en railway.json (raíz y admin-panel/) + campo `productName` no existe en OrderItem (es `name`) en layaways/route.ts y serialize.ts. Retrocompatible con la app (DTO ya tenía fallback productName→name) | (commit del fix) |
| F5+ — Editor de productos (ProductForm + páginas nuevo/editar), página de Ventas con Recharts (LineChart ingresos, PieChart métodos, BarChart top productos), configuración de tienda (NUEVO endpoint PUT /api/admin/shop/stores/[id] con encryptField para llaves de pago); overview con tiles de Ventas y Configuración | `8a6b961` |
| F5 SaaS — dashboard admin web del módulo shop: /admin/tiendas (selector con KPIs), /admin/tiendas/[storeId] (overview con ingresos 30d), pedidos con filtros y acciones (cambio de estado respetando TRANSITIONS, pago/abono en efectivo), apartados con progreso (vencidos/próximos a vencer resaltados), productos con toggle de activación. Sidebar + link 'Tiendas'. | `206a43d` |
| F5 Android — productFlavors dimensión 'tienda' (generic + demo) con SHOP_BASE_URL/SHOP_TENANT_KEY/app_name por flavor; docs/FASE5_WHITELABEL.md con receta de 4 pasos para agregar una tienda | repo android `d867c8b` |
| `.claude/` alineado a la arquitectura real + skill ecommerce-api | `783a3b8`, `0a48d66` |
| App Android (repo `tiendaropa-android`): F2 catálogo sync + detalle, F3 checkout/pagos, navegación dual | su main `c02b3b9` |
| Enforcement real de `Store.isActive`: bloquea login NextAuth (`authorize()`), revalida en cada `getAdminSession()` (revoca sesión ya emitida si la tienda se desactiva), y POS-web (`tienda/page.tsx`) ya no cae en "modo demo" silencioso ante 401/403 — fuerza logout real | `3769fe6`, `959b635` |
| Gestión de credenciales del dueño desde el SaaS: `GET/PATCH /api/admin/shop/stores/[id]/owner` (email + reset de password con temp password de un solo uso) + UI en `StoreAddOnCard.tsx` | `959b635` |
| Logout + cambio de contraseña propio del dueño, en LAS DOS superficies: POS-web (`PATCH /api/shop/employees/me/password`, Bearer) y app Android (`PATCH /api/admin/shop/employees/me/password`, sesión NextAuth) | backend `1c16a54`+`3459e96`; Android `2c56e1d` (CI "Android Build": success) |
| Skill `/ceo-review`: auditoría de integración cruzada entre los 3 repos (contratos de API, auth, paridad de features, multi-tenant, docs, orden de deploy). Replicado en los 3 repos | `9559889` (este repo), espejo en `tienda-ropa-design` y `tiendaropa-android` |
| Hardening de producción: `railway.json` usa `prisma migrate deploy` (ya NO `db push --accept-data-loss`), `GET /api/health` (SELECT 1) como `healthcheckPath`, `.env.example` documenta pooling (`?connection_limit=5&pool_timeout=10`) | `7d7095d`, `99a4c8a` |

## 🚧 NO hecho todavía (no asumir lo contrario)
- Deploy real en Railway con env vars (CIPHER_MASTER_KEY, SHOP_JWT_SECRET,
  CRON_SECRET, MP/CONEKTA_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL) + registrar
  webhooks en MP/Conekta + configurar cron hacia `/api/cron/expire-layaways`
  con `x-cron-secret`. `.env.example` ya documenta las 4 que faltaban (2026-06-19).
- **Checklist de producción (2026-06-24), 3 puntos que requieren el dashboard
  de Railway/Sentry, no código — no se pueden hacer desde este entorno**:
  1. Confirmar/activar backups automáticos de Postgres en Railway.
  2. Aplicar `?connection_limit=5&pool_timeout=10` en el `DATABASE_URL` REAL
     de Railway (ya documentado en `.env.example`, falta aplicarlo).
  3. Crear un ambiente de staging separado (Railway service + `DATABASE_URL`
     propios) — hoy solo existe `main` → producción, sin entorno intermedio.
  4. (Opcional) Integrar Sentry — requiere que el usuario cree cuenta/DSN.
- Compilar APK por flavor en máquina del usuario:
  `./gradlew assembleDemoDebug -PdemoSHOP_TENANT_KEY=tk_...` (cloud no tiene SDK).
- Tests automatizados (no existe suite; ver `.claude/rules/testing.md`)
- Probar en real el flujo POS nuevo (admin embebido y empleado+X-Tenant-Key):
  venta de mostrador → stock decrementado → aparece en `/admin/tiendas/[id]/ventas`.

## ▶️ SIGUIENTE PASO EXACTO
1. **Deploy del SaaS en Railway** con env vars completas (ver `.env.example`
   actualizado: CIPHER_MASTER_KEY, SHOP_JWT_SECRET, CRON_SECRET,
   MERCADO_PAGO_WEBHOOK_SECRET, CONEKTA_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL).
   Registrar webhooks en MP/Conekta apuntando a `https://<host>/webhook/{mercadopago,conekta}`.
   Configurar scheduler horario hacia `/api/cron/expire-layaways` con `x-cron-secret`.
   Ver `.claude/skills/deploy/deploy-config.md`.
2. **Validar builds Android por flavor** en la máquina del usuario
   (`./gradlew assembleGenericDebug` y `./gradlew assembleDemoDebug
   -PdemoSHOP_BASE_URL=... -PdemoSHOP_TENANT_KEY=tk_...`).
3. **Pruebas end-to-end** en producción:
   - Crear producto desde /admin/tiendas/[id]/productos/nuevo y verificar que
     la app lo sincroniza en el siguiente tick (sync incremental por updatedAt).
   - Configurar llaves de pago en /admin/tiendas/[id]/configuracion (entrar
     APP_USR-... o key_...) → crear pedido + pagarlo → confirmar que la página
     /admin/tiendas/[id]/ventas grafica el ingreso.
   - Crear apartado → abonar → verificar que la barra de progreso en
     /admin/tiendas/[id]/apartados avanza.
4. Cuando algo falle, usar el agente debugger (causa raíz primero); cuando se
   abra sesión nueva, leer este archivo + auditar git ANTES de codear.

## ⚠️ GOTCHAS — errores REALES ya cometidos; no repetir
1. **Rutas absolutas SIEMPRE** en herramientas (`/home/claude/...`). Las relativas crearon basura en `/admin-panel` y `/app`.
2. **Verificar número/identidad de un PR antes de mergear.** Se mergeó "PR #2" creyendo que era F3 y era otro PR viejo.
3. **Push ≠ commit.** Se subió una rama vacía y se reportó una fase como entregada. Verificar `git log origin/main..HEAD` antes de declarar éxito.
4. **El main local envejece**: los merges via API de GitHub no actualizan el clon. `git fetch` antes de cualquier comparación o rama nueva.
5. **Schema de Prisma: EDITAR, jamás anexar.** Los duplicados vinieron de `cat >>`. Validar con getDMMF tras cada cambio.
6. **Al reanudar tras compactación**: leer este archivo + `git status` + `git log -5` ANTES de escribir código. La sesión perdida re-implementó auth que ya existía y rompió imports.
7. El entorno NO tiene Android SDK ni acceso a binarios de Prisma engines (usar getDMMF WASM). `gradlew` solo corre en la máquina del usuario.
8. Repos: `then-10/saas-mejorado` (este) y `then-10/tiendaropa-android`. Una sola rama: `main`. El usuario autoriza commit+push directo a main.

9. **Verificar el SCHEMA REAL antes de hacer `select` Prisma.** Casos repetidos de la sesión perdida: `OrderItem.productName` (es `name`) en `layaways/route.ts`, `Customer.firstName/lastName` (es solo `name`) en `me/route.ts`. TypeScript local no los atrapa por inferencia diferida; **el build de producción de Next.js sí**, y aborta el deploy en Railway. Antes de cualquier `select`: `grep -A20 "^model <Nombre>" admin-panel/prisma/schema.prisma`.
10. **Railway no acepta `"builder": ""` (string vacío).** Si no sabes qué builder usar, **omite el campo entero**; Railway autodetecta Nixpacks por la presencia de `package.json`.
11. **NUNCA usar `prisma db push --accept-data-loss` como `startCommand` de producción** (estuvo así hasta 2026-06-24, corregido a `prisma migrate deploy` en `7d7095d`). `db push` no versiona el cambio y `--accept-data-loss` puede borrar columnas/tablas silenciosamente con datos reales de tiendas. Antes de cambiar a `migrate deploy`, confirmar que no hay drift entre `schema.prisma` y `prisma/migrations/` (sin DB real para `prisma migrate diff`, revisar manualmente que cada campo nuevo del schema tenga su carpeta de migración).
12. **Subagentes en background pueden alucinar hallazgos "críticos".** El skill `/ceo-review` reportó una "violación multi-tenant" (DTOs Android mandando `storeId`) que resultó ser el diseño correcto al verificar el código real (`canAccessStore()` ya lo valida server-side en `admin-session.ts`). Verificar SIEMPRE hallazgos de subagentes contra el código antes de actuar.
## 🔍 Comandos de auditoría al iniciar sesión
```bash
cd /home/claude/saas-mejorado 2>/dev/null || git clone https://github.com/then-10/saas-mejorado.git
git fetch origin && git status --short && git log origin/main --oneline -5
git log origin/main..HEAD --oneline   # ¿hay commits sin subir?
ls /home/claude                        # ¿clones ya presentes?
```

## 🗺️ Mapa rápido
- Backend funcional: `admin-panel/` (Next.js 14 + Prisma 5). `backend/` = esqueleto legado.
- Módulo shop: ver `.claude/skills/ecommerce-api/SKILL.md` (mapa completo + curl).
- Config/agentes: `.claude/` · Docs de fases de la app: repo android `docs/FASE*.md`.
