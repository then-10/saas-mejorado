# Validación y Testing — saas-mejorado

## Estado actual (honesto)
El proyecto AÚN NO tiene suite de tests configurada. Hasta que exista, toda
contribución al módulo e-commerce se valida con:

```bash
cd admin-panel
npx tsc --noEmit                      # 0 errores en los archivos tocados
node -e "require('@prisma/internals')" 2>/dev/null && \
  npx tsx -e "import {getDMMF} from '@prisma/internals'; ..." # schema válido (ver historial F1)
npx prisma validate                   # alternativa simple para el schema
```

Y con pruebas manuales vía curl contra `npm run dev` (ver `.claude/skills/ecommerce-api/SKILL.md`).

## Cuando se agregue la suite (objetivo)
- Framework sugerido: Vitest (mejor DX con Next.js/TS que Jest).
- Unit: `*.test.ts` junto al archivo. Integración: `admin-panel/__tests__/`.

### Prioridades de cobertura
1. Aislamiento multi-tenant: una petición con `X-Tenant-Key` de la tienda A jamás
   devuelve/escribe datos de la tienda B.
2. Creación de pedido: precios server-side, stock condicional (409 al agotarse),
   transacción completa o nada.
3. Webhooks: firma inválida → no toca BD; evento duplicado → idempotente.
4. Auth: token expirado/forjado → 401; cliente de otra tienda → 404.

### Mocking
- Mockear: fetch a Mercado Pago/Conekta, envío de notificaciones.
- NO mockear Prisma en integración: usar PostgreSQL de prueba (`*_test`).

## Aplica a
`admin-panel/**`
