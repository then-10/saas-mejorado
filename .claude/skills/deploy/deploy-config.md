# Configuración de Deploy — admin-panel

## Entornos
| Entorno | Cómo | Notas |
|---|---|---|
| Local dev | `cd admin-panel && npm run dev` | Puerto 3001 (ver package.json); BD Postgres local o de Railway |
| Producción | Railway, auto-deploy desde `main` | Postgres administrado por Railway |

## Variables de entorno requeridas

### Núcleo
| Variable | Requerida | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | PostgreSQL (Railway la inyecta). En prod agregar `?connection_limit=5&pool_timeout=10` para no agotar conexiones |
| `NEXTAUTH_URL` | Sí | URL pública del panel |
| `NEXTAUTH_SECRET` | Sí | `openssl rand -hex 32` |

### Módulo e-commerce (Fase 1+)
| Variable | Requerida | Notas |
|---|---|---|
| `SHOP_JWT_SECRET` | Sí | JWT de clientes finales (jose). DISTINTO de NEXTAUTH_SECRET |

### Pagos (Fase 3+)
| Variable | Requerida | Notas |
|---|---|---|
| `CIPHER_MASTER_KEY` | Sí | 64 hex chars (32 bytes) — cifra llaves MP/Conekta en BD |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Si se usa MP | Del dashboard de MP |
| `CONEKTA_WEBHOOK_SECRET` | Si se usa Conekta | Del dashboard de Conekta |
| `NEXT_PUBLIC_BASE_URL` | Sí (F3) | URL pública, usada en back_urls/notification_url |

### Notificaciones (Fase 4, opcionales)
| Variable | Notas |
|---|---|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp al dueño |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` | Telegram al dueño |

## Arranque
1. PostgreSQL accesible → 2. `prisma migrate deploy`/`db:push` → 3. `next start`.

## Salud
- `GET /api/health` — healthcheck usado por Railway (`railway.json` →
  `healthcheckPath`), hace `SELECT 1` contra Postgres.
- `GET /api/shop/products` con un `X-Tenant-Key` válido responde 200 con JSON.
- La home del panel responde 200.
