# SaaS Mejorado — Claude Code Project Guide

## Project Overview

AI-powered multi-tenant sales platform combining omnichannel bots (Telegram, WhatsApp), intelligent lead management, visual sales pipeline, and real-time analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18+, Express.js, TypeScript |
| Database | PostgreSQL 14+, Prisma ORM, Redis |
| Frontend | React 18+, TypeScript, Redux Toolkit, Material-UI, Tailwind CSS |
| Real-time | Socket.io |
| Queue | BullMQ |
| Auth | JWT + refresh tokens (RBAC) |
| Bots | python-telegram-bot 20.7, Evolution API (WhatsApp) |
| AI | Claude API (Anthropic) — `anthropic` npm package |
| Automation | n8n |
| CRM | Bitrix24, HubSpot, Pipedrive |
| Deploy | Docker / Railway |

## Repository Structure

```
saas-mejorado/
├── backend/          # Express.js API server
│   ├── server.js     # Entry point
│   ├── routes/       # API route handlers
│   ├── middleware/   # Auth, validation, rate limiting
│   ├── services/     # Business logic
│   └── models/       # Prisma models / DB queries
├── frontend/         # React + TypeScript SPA
├── bots/
│   └── telegram/     # Python Telegram bot
├── database/
│   └── schema.sql    # PostgreSQL schema
├── .claude/          # Claude Code configuration
└── docker-compose.yml
```

## Common Commands

```bash
# Development
npm run dev                  # Start backend with nodemon
npm run lint                 # ESLint TypeScript
npm run lint:fix             # Auto-fix lint issues

# Database
npm run db:migrate           # Apply Prisma migrations
npm run db:push              # Push schema (dev only)
npm run db:seed              # Seed test data

# Testing
npm test                     # Run Jest suite
npm run test:watch           # Watch mode

# Build & Deploy
npm run build                # Build backend + frontend
npm run docker:compose       # Start all services via Docker Compose

# Python Bot
cd bots/telegram && pip install -r requirements.txt
python bot_improved.py
```

## Coding Conventions

- TypeScript strict mode for all backend and frontend code
- ESLint with `@typescript-eslint` — no `any` types without justification
- Prisma ORM for all DB queries — never raw SQL except in migrations
- JWT auth on all `/api/*` routes except `/api/auth/*` and webhooks
- Multi-tenancy: every DB query must scope to `saas_client_id`
- Claude API calls use `anthropic` npm package — include system prompt with tenant context
- Environment variables via `dotenv` — never hardcode secrets
- See `.claude/rules/` for detailed per-topic conventions

## Architecture Invariants

- **Tenant isolation**: Every database query filters by `saas_client_id`. No cross-tenant data leakage.
- **Stateless API**: No server-side session state; all auth via JWT.
- **Async jobs**: Long-running tasks (AI calls, webhook deliveries) go through BullMQ — never block the request thread.
- **Real-time**: Use Socket.io rooms scoped per tenant for live updates.

## Key API Endpoints

```
POST   /api/auth/login          # JWT login
POST   /api/auth/refresh        # Token refresh
GET    /api/leads               # List leads (tenant-scoped)
POST   /api/leads/:id/qualify   # AI qualification via Claude
GET    /api/analytics/dashboard # Sales KPIs
POST   /webhook/telegram        # Telegram bot hook
POST   /webhook/whatsapp        # WhatsApp bot hook
```

## Environment Variables

See `.env.example` for the full list. Critical ones:
- `ANTHROPIC_API_KEY` — Claude AI
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — must be 256-bit random
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `REDIS_URL` — for BullMQ and sessions

## Local Overrides

Developer-specific settings go in `CLAUDE.local.md` (gitignored). Use it to override commands, add personal API keys for testing, or note local environment quirks.
