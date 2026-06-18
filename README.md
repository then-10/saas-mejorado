# SaaS Mejorado - AI-Powered Sales Platform

## 🚀 Descripción General

SaaS Mejorado es una plataforma integral de ventas potenciada por IA que combina:

- **Bot de IA Multi-Canal** (Telegram, WhatsApp, Telegram Business)
- **Dashboard CRM Inteligente** para gestión de leads y oportunidades
- **Gestión Multi-Tenant** para múltiples empresas
- **Análisis de Ventas en Tiempo Real** con métricas de desempeño
- **Automatización de Flujos de Trabajo** con n8n
- **Integración con APIs Externas** (Bitrix24, CRM providers)


## 🛍️ Módulo E-commerce (Fases 1-5 ENTREGADAS)

Sobre este SaaS se agregó un **módulo completo de e-commerce multi-tenant**:
cada cliente del SaaS tiene su propia app Android (`then-10/tiendaropa-android`)
con catálogo, pedidos, pagos (Mercado Pago / Conekta), apartados con abonos y
notificaciones al dueño. El super-admin lo administra desde `/admin/tiendas`.

- **Estado**: F1, F3, F4 y F5 en `main`. Ver [`ESTADO_PROYECTO.md`](./ESTADO_PROYECTO.md).
- **Documentación**:
  - [`docs/MODULO_ECOMMERCE.md`](./docs/MODULO_ECOMMERCE.md) — visión general, mapa del código, variables.
  - [`docs/API.md`](./docs/API.md) — referencia de endpoints (cliente, admin, webhooks, cron).
  - [`docs/FASE4_AUTH_APARTADOS.md`](./docs/FASE4_AUTH_APARTADOS.md) — auth de clientes y semántica de apartados.
  - [`docs/FASE5_DASHBOARD_ADMIN.md`](./docs/FASE5_DASHBOARD_ADMIN.md) — guía operativa del dashboard.

## 🏗️ Arquitectura

Ver `ARCHITECTURE.md` para documentación completa de la arquitectura del sistema.

## ✨ Características Principales

### 1. **Bot de IA Omnichannel**
- Soporte para Telegram, WhatsApp y APIs REST
- Conversaciones contextuales con Claude AI
- Manejo de lenguaje natural avanzado
- Respuestas personalizadas por empresa

### 2. **Gestión de Leads Inteligente**
- Calificación automática de leads con IA
- Enrutamiento inteligente a sales team
- Historial completo de interacciones
- Scoring dinámico de oportunidades

### 3. **Dashboard CRM Completo**
- Pipeline visual de ventas
- Gestión de contactos y empresas
- Seguimiento de actividades
- Reportes en tiempo real
- Integración con WhatsApp y Telegram

### 4. **Multi-Tenancy Robusto**
- Aislamiento de datos por empresa
- Configuración personalizada por cliente
- Llaves API únicas por tenant
- Auditoría de acceso y cambios

### 5. **Análisis y Reportes**
- Dashboard de métricas de ventas
- Análisis de rendimiento de equipos
- Predicción de conversiones con ML
- Exportación de reportes (CSV, PDF)

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL con Prisma ORM
- **Auth**: JWT + OAuth2
- **Queue**: BullMQ para tareas asíncronas
- **Search**: Elasticsearch (opcional)

### Frontend
- **Framework**: React 18+ con TypeScript
- **State**: Redux Toolkit
- **UI**: Material-UI + Tailwind CSS
- **Real-time**: Socket.io
- **Charts**: Chart.js / Recharts

### Bots & Integrations
- **Telegram**: python-telegram-bot 20.7
- **WhatsApp**: Evolution API / Twilio
- **IA**: Claude API (Anthropic)
- **CRM**: Bitrix24, HubSpot, Pipedrive
- **Automation**: n8n

## 📦 Instalación

### Requisitos Previos
```bash
Node.js >= 18.x
PostgreSQL >= 14
Docker (opcional)
Python >= 3.10 (para bots)
```

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno
npm run db:migrate
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Bot Setup (Telegram)
```bash
cd bots/telegram
pip install -r requirements.txt
cp .env.example .env
# Configurar TELEGRAM_BOT_TOKEN
python bot_improved.py
```

## 🔐 Configuración de Ambiente

Ver `.env.example` en cada directorio para la configuración completa.

## 🚀 Despliegue

### Docker Compose
```bash
docker-compose up -d
```

### Producción
```bash
# Backend
npm run build
npm start

# Frontend
npm run build
npm run serve
```

## 📊 Estructura de Base de Datos

Ver `database/schema.sql` para el esquema completo.

Tablas principales:
- `saas_clients` - Empresas clientes
- `sales_leads` - Leads y oportunidades
- `contacts` - Contactos y personas
- `sales_pipeline` - Pipeline de ventas
- `activities` - Registro de actividades
- `users` - Usuarios del sistema
- `teams` - Equipos de ventas
- `analytics_events` - Eventos para análisis

## 🔗 API Endpoints

### Autenticación
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh
POST   /api/auth/logout
```

### Leads
```
GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PUT    /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/:id/qualify
```

### Pipeline
```
GET    /api/pipeline
POST   /api/pipeline/stage
PUT    /api/pipeline/stage/:id
POST   /api/pipeline/move-lead
```

### Analytics
```
GET    /api/analytics/dashboard
GET    /api/analytics/sales-metrics
GET    /api/analytics/team-performance
GET    /api/analytics/forecast
```

### Webhooks
```
POST   /webhook/telegram
POST   /webhook/whatsapp
POST   /webhook/bitrix24
```

## 🤖 Bots

### Telegram Bot
- Comandos: `/start`, `/reset`, `/help`, `/qualify`
- Manejo de conversaciones contextuales
- Integración automática con leads

### WhatsApp Bot
- Respuestas automáticas con IA
- Gestión de conversaciones
- Integración con pipeline de ventas

## 📈 Roadmap

- [ ] Predicción de churn con ML
- [ ] Integración con más CRMs
- [ ] Video conferencias integradas
- [ ] Email automation
- [ ] SMS campaigns
- [ ] Advanced analytics con BigQuery
- [ ] Mobile app (React Native)
- [ ] Marketplace de integraciones

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

MIT License - ver `LICENSE` para detalles

## 📞 Soporte

- 📧 Email: support@saas-mejorado.com
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions
- 🌐 Docs: https://docs.saas-mejorado.com

## 🙏 Reconocimientos

Este proyecto integra lo mejor de:
- SaaS-abacus: Arquitectura multi-tenant y API AI
- bot-saas: Integración con Claude AI y Telegram
- Repositorios de referencia en CRM y lead management
