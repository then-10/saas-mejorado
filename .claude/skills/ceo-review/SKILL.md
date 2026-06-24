---
name: ceo-review
description: Auditoría de integración entre los 3 repos del producto (saas-mejorado, tienda-ropa-design, tiendaropa-android) — confirma que backend, app del dueño y app de respaldo funcionen como un solo producto coherente. Se activa con "ceo review", "auditoría de integración", "¿todo está conectado?", o antes de un release que toque más de un repo.
---

# Skill: CEO Review — integración multi-repo TiendaRopa

Rol: actuar como "CEO técnico" del producto completo, no de un repo aislado.
El objetivo no es la calidad de un archivo — es que **los 3 repos sigan siendo
un solo producto que funciona de punta a punta**. Es una auditoría de
**solo lectura**: reporta hallazgos, no aplica cambios salvo que el usuario
lo pida explícitamente después de ver el reporte.

## Los 3 repos y su rol real

| Repo | Rol real | Quién lo consume |
|---|---|---|
| `saas-mejorado` (`admin-panel/`) | Backend único, fuente de verdad de datos y contratos de API | Todos los demás |
| `tienda-ropa-design` | App Android **activa** del dueño (la que se sigue desarrollando) | Dueño de tienda |
| `tiendaropa-android` | App Android de **respaldo/legado** — puede haber quedado desincronizada | Histórico / no tocar sin que el usuario lo pida |

`tienda-ropa-design` no tiene `.claude/` propio salvo este skill — sus
convenciones reales viven en `tiendaropa-android/.claude/` (mismo dominio,
repo hermano). Si una convención no está documentada en `tienda-ropa-design`,
revisar la versión en `tiendaropa-android` antes de asumir que no existe.

## Qué revisar, en orden de impacto

### 1. Contratos de API (backend ↔ apps)
- Para cada endpoint Retrofit en `tienda-ropa-design` (`data/remote/service/*.kt`),
  confirmar que existe el `route.ts` correspondiente en
  `saas-mejorado/admin-panel/src/app/api/**` con el mismo método HTTP y path.
- Comparar campo a campo los DTOs (`@SerialName`/`@SerializedName`) contra la
  forma real de respuesta del route handler (después de pasar por
  `serialize.ts` si hay `Decimal`).
- Igual ejercicio para `tiendaropa-android` si el usuario pide incluirlo —
  por defecto, solo reportar si está desincronizado, sin asumir que debe
  igualarse a `tienda-ropa-design`.

### 2. Auth y permisos cruzados
- `/api/shop/*` espera `X-Tenant-Key` + Bearer JWT empleado → confirmar que
  el cliente Android que lo llama (app cliente final) realmente los envía.
- `/api/admin/shop/*` espera sesión NextAuth por cookie → confirmar que el
  cliente Android (app del dueño) usa `PersistentCookieJar` y no intenta
  mandar un Bearer ahí por error.
- Confirmar que `Store.isActive` y `customerAppAccessEnabled` bloquean en
  TODAS las superficies (POS-web, API admin, API shop, login NextAuth) — no
  solo en el backend, sino que el cliente realmente respeta el 401/403 y no
  cae en un fallback silencioso (el bug real ya encontrado una vez en
  `tienda/page.tsx`: modo demo enmascarando un 401).

### 3. Paridad de features entre superficies "del dueño"
El dueño tiene DOS superficies (POS-web y app Android). Antes de marcar una
feature como "lista", confirmar que existe en ambas si la feature es de
cuenta/sesión (login, logout, cambio de contraseña, recuperación). Revisar
`git log` reciente de los 3 repos para detectar features que solo se
implementaron en una superficie.

### 4. Consistencia de invariantes de arquitectura
- Multi-tenant: todo query del módulo shop debe derivar `storeId` del
  request (`resolveStore`/`getAdminSession`), nunca del body/params del
  cliente — válido para los 3 repos por igual (ningún DTO Android debe
  mandar `storeId` explícito).
- Revisar que `CLAUDE.md`/`ESTADO_PROYECTO.md` de cada repo no contradigan
  lo que el código realmente hace (documentación desactualizada cuenta como
  hallazgo).

### 5. Salud de producción (delegar detalle a `/deploy`)
No repetir el checklist completo de `/deploy` — solo confirmar que no hay
una feature recién pusheada en los repos Android que dependa de un cambio
de backend que todavía no llegó a producción (orden de despliegue).

## Formato del reporte
Markdown corto, por sección (1–5 arriba), cada hallazgo con:
`✅ cubierto` / `⚠️ riesgo` / `❌ roto` — archivo:línea cuando aplique, y
una propuesta de fix de una línea. Sin relleno, sin repetir el código.
Termina con un máximo de 3 acciones priorizadas, no una lista exhaustiva.

## Aplica a
Los 3 repos completos. No requiere tocar código salvo que el usuario lo
pida después de leer el reporte.
