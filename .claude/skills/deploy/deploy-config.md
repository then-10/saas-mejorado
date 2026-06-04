# Deploy Configuration

## Environments

### Local Dev (`docker-compose`)

| Service | Port | Notes |
|---------|------|-------|
| Backend API | 3000 | Express.js |
| Frontend | 5173 | Vite dev server |
| PostgreSQL | 5432 | `saas_mejorado_dev` database |
| Redis | 6379 | Sessions + BullMQ |

**Compose file**: `docker-compose.yml` at repo root.

### Staging (Railway)

- Branch: `develop` auto-deploys to staging
- URL: `https://saas-mejorado-staging.up.railway.app`
- Database: Railway-managed PostgreSQL (staging project)
- Redis: Railway-managed Redis

### Production (Railway)

- Branch: `main` auto-deploys to production
- URL: configured in Railway domain settings
- Database: Railway-managed PostgreSQL (production project)
- Redis: Railway-managed Redis

## Required Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3000` |
| `DATABASE_URL` | Yes | `postgresql://...` |
| `REDIS_URL` | Yes | `redis://...` |
| `JWT_SECRET` | Yes | 256-bit random string |
| `JWT_REFRESH_SECRET` | Yes | 256-bit random string |
| `ANTHROPIC_API_KEY` | Yes | `sk-ant-...` |
| `TELEGRAM_BOT_TOKEN` | Yes | From BotFather |
| `TELEGRAM_WEBHOOK_URL` | Yes | `https://your-domain.com/webhook/telegram` |
| `TELEGRAM_SECRET_TOKEN` | Yes | Random token for webhook verification |
| `WHATSAPP_EVOLUTION_URL` | Yes (if WhatsApp enabled) | Evolution API URL |
| `WHATSAPP_API_KEY` | Yes (if WhatsApp enabled) | Evolution API key |
| `BITRIX24_WEBHOOK_URL` | No | For CRM sync |
| `CORS_ORIGIN` | Yes | Frontend domain |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` |
| `RATE_LIMIT_MAX` | No | `500` |

## Service Startup Order

1. PostgreSQL (must be accepting connections)
2. Redis (must be ready)
3. Backend API (runs `prisma migrate deploy` on boot)
4. Frontend (static build or Vite)
5. Telegram bot (Python process — separate dyno/worker)

## Health Endpoints

| Endpoint | Expected response |
|----------|------------------|
| `GET /api/health` | `{ "status": "ok", "db": "connected", "redis": "connected" }` |
| `GET /api/health/bot` | `{ "telegram": "active", "whatsapp": "active" }` |

## Resource Sizing (Production)

| Service | Min RAM | Min CPU |
|---------|---------|---------|
| Backend API | 512 MB | 0.5 vCPU |
| PostgreSQL | 1 GB | 1 vCPU |
| Redis | 256 MB | 0.25 vCPU |
| Telegram Bot | 256 MB | 0.25 vCPU |
