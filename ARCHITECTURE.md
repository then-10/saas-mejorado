# SaaS Mejorado - Detailed Architecture

## System Overview

SaaS Mejorado is a multi-tenant sales platform that combines:
1. **AI-powered chatbots** (Telegram, WhatsApp)
2. **Intelligent lead management** with auto-qualification
3. **Sales pipeline management** with visual Kanban boards
4. **Real-time analytics and reporting**
5. **CRM integrations** (Bitrix24, HubSpot, Pipedrive)
6. **Multi-tenant architecture** for scalability

## Technology Stack

### Backend
- **Node.js 18+** with Express.js
- **PostgreSQL** for relational data
- **Redis** for caching and sessions
- **Socket.io** for real-time updates
- **BullMQ** for async job processing
- **JWT** for authentication

### Frontend
- **React 18+** with TypeScript
- **Redux Toolkit** for state management
- **Material-UI + Tailwind CSS** for UI
- **Socket.io-client** for real-time features
- **Chart.js/Recharts** for analytics

### AI & Bots
- **Claude AI (Anthropic)** for conversational AI
- **python-telegram-bot** for Telegram integration
- **Evolution API** for WhatsApp integration
- **n8n** for workflow automation

## Database Design

### Multi-Tenancy Model
```
saas_clients (accounts/companies)
├── users (employees)
├── teams (sales teams)
├── sales_leads (opportunities)
├── chat_logs (bot conversations)
├── activities (tasks/calls/emails)
└── bot_configs (channel configurations)
```

## API Architecture

### Authentication
```
POST /api/auth/login
  - JWT token generation
  - Refresh token rotation
  - Multi-device support
```

### Lead Management
```
GET    /api/leads                    # List with filters/pagination
POST   /api/leads                    # Create new lead
GET    /api/leads/:id                # Lead details
PUT    /api/leads/:id                # Update lead
DELETE /api/leads/:id                # Soft delete
POST   /api/leads/:id/qualify        # AI-powered qualification
POST   /api/leads/:id/assign         # Assign to sales rep
```

### Analytics
```
GET /api/analytics/dashboard         # Overview metrics
GET /api/analytics/sales-metrics     # Sales KPIs
GET /api/analytics/team-performance  # By-team metrics
GET /api/analytics/forecast          # Revenue forecast
GET /api/analytics/bot-stats         # Bot performance
```

### Webhooks
```
POST /webhook/telegram      # Telegram message handler
POST /webhook/whatsapp      # WhatsApp message handler
POST /webhook/bitrix24      # Bitrix24 events handler
```

## Bot Architecture

### Message Flow
```
1. User sends message to Telegram/WhatsApp
   ↓
2. Bot receives webhook event
   ↓
3. Extract user context (name, preferences, history)
   ↓
4. Send to Claude AI with system prompt
   ↓
5. Generate contextual response
   ↓
6. Log interaction to database
   ↓
7. Check if lead qualification needed
   ↓
8. If yes: Create/update lead in system
   ↓
9. Send response to user
```

## Real-time Updates

Using Socket.io for live features:
- Lead status changes
- Pipeline updates
- Team activity
- Analytics updates
- Chat notifications
- System alerts

## Security Layers

1. **Authentication**: JWT + refresh tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Encryption**: TLS for transport, AES-256 for sensitive data
4. **Isolation**: Tenant data segregation at database level
5. **Rate Limiting**: API request throttling
6. **Input Validation**: Sanitization and schema validation
7. **Audit Logging**: All data changes tracked

## Scaling Strategy

### Horizontal Scaling
- Stateless API servers behind load balancer
- Database connection pooling
- Redis for distributed caching
- BullMQ for distributed job processing

### Vertical Scaling
- Database optimization with indexes
- Query caching strategies
- Batch processing for large operations
- Archive old data to cold storage

## Performance Metrics

- API response time: <200ms (p95)
- Bot response time: <1s
- Database query time: <50ms (p95)
- Concurrent users: 10,000+
- Throughput: 10,000 requests/min

## Deployment

### Development
```bash
docker-compose up
```

### Production
- Docker containers on Kubernetes
- RDS PostgreSQL (managed)
- ElastiCache Redis
- CloudFront CDN
- Application Load Balancer
- CloudWatch monitoring
