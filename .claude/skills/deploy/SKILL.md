---
name: deploy
description: Despliegue del SaaS (admin-panel Next.js + Prisma) a Railway. Se activa con "deploy", "desplegar", "release", "publicar", "subir a producción" o menciones de Railway/variables de entorno.
---

# Skill: Deploy — saas-mejorado

El servicio desplegable es **`admin-panel/`** (Next.js 14 + Prisma). `backend/` es
un esqueleto legado: no se despliega.

## Checklist pre-deploy
- [ ] `npx tsc --noEmit` sin errores en `admin-panel/`
- [ ] `npx prisma validate` OK; migraciones aplicadas (`npm run db:push` o `migrate deploy`)
- [ ] Variables de `deploy-config.md` configuradas en Railway (incluidas las del módulo shop)
- [ ] `SHOP_JWT_SECRET`, `NEXTAUTH_SECRET` y `CIPHER_MASTER_KEY` ≠ valores de desarrollo
- [ ] Webhooks de pago apuntando a la URL pública (ver abajo)

## Deploy (Railway)
- Push a `main` → auto-deploy del servicio conectado al repo.
- Manual: `railway up` (requiere `npm i -g @railway/cli` + `railway login`).
- Logs: `railway logs` o dashboard.

## Primera vez / nueva tienda
```bash
cd admin-panel
npm install
npm run db:push            # aplica el schema (incluye modelos e-commerce)
npx prisma generate
npx tsx prisma/seed-shop.ts   # crea tienda demo e imprime el X-Tenant-Key
```

## Webhooks de pago (config en dashboards externos)
| Proveedor | URL a registrar | Secreto en env |
|---|---|---|
| Mercado Pago | `https://<dominio>/webhook/mercadopago` | `MERCADO_PAGO_WEBHOOK_SECRET` |
| Conekta | `https://<dominio>/webhook/conekta` | `CONEKTA_WEBHOOK_SECRET` |

## Verificación post-deploy
```bash
# Catálogo de la tienda demo (sustituir tenant key del seed)
curl -s https://<dominio>/api/shop/products -H "X-Tenant-Key: tk_..." | head -c 300
# Panel admin responde
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio>/
```

## Rollback
Railway dashboard → Deployments → Redeploy del deploy anterior (o `railway down` + redeploy).
