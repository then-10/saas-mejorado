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
- **Último hito:** Fase 4 ENTREGADA — backend (apartados con abonos vía proveedor, webhooks/polling idempotentes conscientes de LAYAWAY, expiración por cron) y app Android (auth, pedidos remotos, apartados con abonos).
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
| `.claude/` alineado a la arquitectura real + skill ecommerce-api | `783a3b8`, `0a48d66` |
| App Android (repo `tiendaropa-android`): F2 catálogo sync + detalle, F3 checkout/pagos, navegación dual | su main `c02b3b9` |

## 🚧 NO hecho todavía (no asumir lo contrario)
- F4 admin: endpoints/vistas admin específicas de apartados (la app del dueño aún
  no tiene UI dedicada; los abonos en efectivo ya se registran por el endpoint
  `/api/admin/shop/orders/[id]/payments/cash` existente, consciente de layaway)
- F5: white-label por tienda (flavors Android), dashboard admin web del módulo shop
- Deploy real en Railway con env vars de F3/F4 (CIPHER_MASTER_KEY, SHOP_JWT_SECRET,
  CRON_SECRET, MP/CONEKTA_WEBHOOK_SECRET) + registrar webhooks en MP/Conekta +
  configurar cron de Railway hacia `/api/cron/expire-layaways` con `x-cron-secret`
- Compilar APK en máquina del usuario (`./gradlew assembleDebug`) — el entorno
  cloud no tiene Android SDK
- Tests automatizados (no existe suite; ver `.claude/rules/testing.md`)

## ▶️ SIGUIENTE PASO EXACTO
1. **Compilar la app en la máquina del usuario**: `./gradlew assembleDebug` (el
   entorno cloud no tiene Android SDK). Ajustar `local.properties` con
   `SHOP_BASE_URL`, `SHOP_TENANT_KEY` y `STORE_OWNER_MODE=false`.
2. **Deploy del SaaS en Railway** con las env vars de la tabla
   `.claude/skills/deploy/deploy-config.md`. Registrar webhooks de MP/Conekta y
   un scheduler que pegue cada hora a `/api/cron/expire-layaways` con header
   `x-cron-secret`.
3. **Prueba end-to-end** del flujo de apartado: app crea pedido LAYAWAY → paga
   anticipo (CARD/SPEI/OXXO) → abona dos veces → al cubrir el total el pedido
   queda PAID. Verificar idempotencia: pulsar el polling y el webhook a la vez
   no debe duplicar paidAmount (claim atómico en `applyPaidPayment`).
4. **F5**: white-label (flavors por tienda) + vistas admin de apartados.

## ⚠️ GOTCHAS — errores REALES ya cometidos; no repetir
1. **Rutas absolutas SIEMPRE** en herramientas (`/home/claude/...`). Las relativas crearon basura en `/admin-panel` y `/app`.
2. **Verificar número/identidad de un PR antes de mergear.** Se mergeó "PR #2" creyendo que era F3 y era otro PR viejo.
3. **Push ≠ commit.** Se subió una rama vacía y se reportó una fase como entregada. Verificar `git log origin/main..HEAD` antes de declarar éxito.
4. **El main local envejece**: los merges via API de GitHub no actualizan el clon. `git fetch` antes de cualquier comparación o rama nueva.
5. **Schema de Prisma: EDITAR, jamás anexar.** Los duplicados vinieron de `cat >>`. Validar con getDMMF tras cada cambio.
6. **Al reanudar tras compactación**: leer este archivo + `git status` + `git log -5` ANTES de escribir código. La sesión perdida re-implementó auth que ya existía y rompió imports.
7. El entorno NO tiene Android SDK ni acceso a binarios de Prisma engines (usar getDMMF WASM). `gradlew` solo corre en la máquina del usuario.
8. Repos: `then-10/saas-mejorado` (este) y `then-10/tiendaropa-android`. Una sola rama: `main`. El usuario autoriza commit+push directo a main.

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
