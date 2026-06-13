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
- **Fecha:** 2026-06-12 · **Rama única:** `main`
- **Último hito:** F5 extras ENTREGADOS — editor completo de productos (crear/editar/desactivar), página de Ventas con Recharts (ingresos por día, métodos de pago, top productos), configuración editable de tienda (con llaves de pago cifradas AES-256-GCM al guardar).
  saneada, schema deduplicado y validado, ramas eliminadas (solo existe main).

## ✅ Hecho y verificado (evidencia = commit en main)
| Qué | Evidencia |
|---|---|
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

## 🚧 NO hecho todavía (no asumir lo contrario)
- Deploy real en Railway con env vars (CIPHER_MASTER_KEY, SHOP_JWT_SECRET,
  CRON_SECRET, MP/CONEKTA_WEBHOOK_SECRET) + registrar webhooks en MP/Conekta +
  configurar cron hacia `/api/cron/expire-layaways` con `x-cron-secret`.
- Compilar APK por flavor en máquina del usuario:
  `./gradlew assembleDemoDebug -PdemoSHOP_TENANT_KEY=tk_...` (cloud no tiene SDK).
- Tests automatizados (no existe suite; ver `.claude/rules/testing.md`)

## ▶️ SIGUIENTE PASO EXACTO
1. **Deploy del SaaS en Railway** con env vars de F3/F4 (CIPHER_MASTER_KEY,
   SHOP_JWT_SECRET, CRON_SECRET, MP/CONEKTA_WEBHOOK_SECRET). Registrar webhooks
   en MP/Conekta. Configurar scheduler horario hacia `/api/cron/expire-layaways`
   con `x-cron-secret`. Ver `.claude/skills/deploy/deploy-config.md`.
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
