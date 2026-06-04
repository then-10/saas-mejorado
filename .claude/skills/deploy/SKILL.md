# Deploy Skill

Auto-triggered when the user asks about deploying, releasing, or publishing the application to any environment.

## Trigger Conditions

This skill is loaded when the conversation contains any of:
- "deploy", "desplegar", "release", "publish", "push to production"
- References to Railway, Docker, or environment promotion

## What This Skill Provides

Context and step-by-step procedures for deploying SaaS Mejorado to:
- **Local dev** via Docker Compose
- **Staging** via Railway (branch deploys)
- **Production** via Railway or Docker on VPS

See `deploy-config.md` for environment variables, ports, and service dependencies per target.

## Pre-Deploy Checklist

Before any deploy, verify:
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — no skipped tests
- [ ] `npm run db:migrate` is current (no pending migrations)
- [ ] `.env` variables listed in `deploy-config.md` are set in the target environment
- [ ] `ANTHROPIC_API_KEY` is valid and has sufficient credits
- [ ] `JWT_SECRET` is not the development default

## Deploy Commands

### Local (Docker Compose)
```bash
docker-compose up -d --build
docker-compose logs -f backend
```

### Railway (staging)
```bash
# Railway CLI must be installed: npm i -g @railway/cli
railway login
railway up --environment staging
railway logs
```

### Railway (production)
```bash
railway up --environment production
# Monitor deploy in Railway dashboard
```

### Manual VPS (Docker)
```bash
npm run docker:build
docker tag saas-mejorado registry.example.com/saas-mejorado:latest
docker push registry.example.com/saas-mejorado:latest
ssh user@vps "docker pull registry.example.com/saas-mejorado:latest && docker-compose up -d"
```

## Post-Deploy Verification

```bash
# Health check
curl https://your-domain.com/api/health

# Check bot webhook is registered
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo
```

## Rollback

```bash
# Railway
railway rollback

# Docker
docker-compose down && docker pull saas-mejorado:previous && docker-compose up -d
```
