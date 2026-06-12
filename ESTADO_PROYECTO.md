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
- **Último hito:** Consolidación total — F3 backend commiteada de verdad, F4 parcial
  saneada, schema deduplicado y validado, ramas eliminadas (solo existe main).

## ✅ Hecho y verificado (evidencia = commit en main)
| Qué | Evidencia |
|---|---|
| F1 — Módulo e-commerce (12 modelos, endpoints shop+admin, multi-tenant X-Tenant-Key, auth clientes login/register con signCustomerToken) | `f74810f` + fix `3d2b528` |
| Fix schema duplicado (¡F1 lo commiteó doble!) validado con getDMMF | `3d2b528` |
| F3 — Pagos backend: adapters MP/Conekta, encryption AES-256-GCM, endpoint crear/verificar pago, webhooks con firma+idempotencia, notificación al dueño (Telegram/WhatsApp por fetch) | `835eb5c` |
| F4 parcial — GET /api/shop/me, GET /api/shop/layaways, serializeLayaway | `fd87bac` |
| `.claude/` alineado a la arquitectura real + skill ecommerce-api | `783a3b8`, `0a48d66` |
| App Android (repo `tiendaropa-android`): F2 catálogo sync + detalle, F3 checkout/pagos, navegación dual | su main `c02b3b9` |

## 🚧 NO hecho todavía (no asumir lo contrario)
- F4: abonos del cliente a apartados vía MP/Conekta · job/cron de expiración de
  apartados (status→EXPIRED) · endpoints admin de apartados · pantallas Android F4
  (login/registro, OrdersScreen, ProfileScreen, LayawayScreen)
- F5: white-label (flavors), dashboard admin web del módulo shop
- Deploy real en Railway con env vars de F3/F4 · typecheck completo con deps instaladas
- Tests automatizados (no existe suite)

## ▶️ SIGUIENTE PASO EXACTO
1. **Android F4**: login/registro contra `/api/shop/auth/*` (guardar JWT en
   EncryptedSharedPreferences) → `me` en ProfileScreen → OrdersScreen →
   LayawaysScreen (consume `GET /api/shop/layaways`).
2. Backend F4 restante: `POST /api/shop/layaways/[id]/payments` (vía provider) y
   expiración de apartados (cron de Railway o ruta protegida + scheduler externo).

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
