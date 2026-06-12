# /project:fix-issue — Arreglar un issue de GitHub

## Uso
```
/project:fix-issue <número>
```

## Flujo
1. **Leer**: `gh issue view $ARGUMENTS` → título, repro, esperado vs actual.
2. **Reproducir**: `cd admin-panel && npm run dev` (puerto 3001) y disparar el caso
   con curl (headers `X-Tenant-Key` / `Authorization` según la superficie).
3. **Causa raíz**: trazar route handler → lib (`tenant`, `customer-auth`, `payments`) → Prisma.
   Revisar historial: `git log --oneline -10 -- <archivo>`.
4. **Fix**: solo los archivos necesarios; seguir `.claude/rules/*`.
5. **Verificar**: `npx tsc --noEmit` + curl del caso reproducido.
6. **PR**: rama `fix/issue-$ARGUMENTS`, commit `fix: <desc> (closes #$ARGUMENTS)`.

## Patrones comunes
| Síntoma | Causa probable | Dónde |
|---|---|---|
| Datos de otra tienda | Falta filtro `storeId` de `resolveStore` | `src/app/api/shop/**` |
| 401 con token válido | Secret equivocado (SHOP vs NEXTAUTH) | `src/lib/shop/customer-auth.ts` |
| Doble cobro | Webhook sin idempotencia | `src/app/webhook/**` |
| Sobreventa | Decremento sin condición de stock | `api/shop/orders/route.ts` |
| JSON con strings raros en precios | `Decimal` sin serializar | `src/lib/shop/serialize.ts` |
