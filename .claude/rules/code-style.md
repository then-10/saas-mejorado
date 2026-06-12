# Estilo de Código — saas-mejorado (admin-panel)

## TypeScript
- Modo estricto; sin `any` implícito. `any` explícito solo con comentario.
- `const` por defecto; `interface` para objetos, `type` para uniones.
- Promesas siempre `await`-eadas; sin floating promises.
- Errores: capturar, responder `NextResponse.json({ error }, { status })` — nunca filtrar stack traces.

## Nombres
- Archivos de rutas: convención App Router (`route.ts` dentro de carpetas kebab-case o `[param]`).
- Librerías compartidas: `admin-panel/src/lib/shop/*.ts` en kebab-case.
- Variables/funciones `camelCase`; tipos `PascalCase`; constantes módulo `UPPER_SNAKE_CASE`.

## Guardia multi-tenant (sin excepciones)
Todo acceso a datos del módulo shop deriva el tenant del request, nunca lo recibe:
```ts
// ✅ Correcto
const store = await resolveStore(req);
if (!store) return unauthorizedTenant();
const products = await prisma.product.findMany({ where: { storeId: store.id } });

// ❌ Incorrecto — tenant del cliente
const { storeId } = await req.json();
const products = await prisma.product.findMany({ where: { storeId } });
```

## Prisma
- Multi-tabla → `prisma.$transaction`.
- `Decimal` nunca llega crudo al JSON: pasar por `serialize.ts`.
- Campos sensibles (`passwordHash`, `apiKey`, `*Enc`) excluidos con `select` en respuestas.

## Secretos
- Solo por `process.env`; documentados en `.env.example` sin valores reales.
- `SHOP_JWT_SECRET` ≠ `NEXTAUTH_SECRET`. Llaves de pago cifradas con `CIPHER_MASTER_KEY`.

## Aplica a
`admin-panel/src/**/*.ts`, `admin-panel/src/**/*.tsx`, `admin-panel/prisma/**`
