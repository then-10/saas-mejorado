# API Conventions

## URL Design

- Base path: `/api/v1/` (version in URL, not header).
- Resources in plural kebab-case: `/api/v1/sales-leads`, `/api/v1/pipeline-stages`.
- Actions that don't map to CRUD: POST to sub-resource verb, e.g. `POST /api/v1/leads/:id/qualify`.
- Webhook endpoints live outside `/api/`: `/webhook/telegram`, `/webhook/whatsapp`.

## HTTP Methods

| Operation | Method | Example |
|-----------|--------|---------|
| List | GET | `GET /api/v1/leads` |
| Create | POST | `POST /api/v1/leads` |
| Read | GET | `GET /api/v1/leads/:id` |
| Full update | PUT | `PUT /api/v1/leads/:id` |
| Partial update | PATCH | `PATCH /api/v1/leads/:id` |
| Delete (soft) | DELETE | `DELETE /api/v1/leads/:id` |

## Request Format

- `Content-Type: application/json` required on all POST/PUT/PATCH.
- All list endpoints accept: `?page=1&limit=20&sort=createdAt&order=desc`.
- Filters as query params: `?status=qualified&assignedTo=userId`.

## Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

Errors:
```json
{
  "success": false,
  "error": {
    "code": "LEAD_NOT_FOUND",
    "message": "Lead 123 not found",
    "details": {}
  }
}
```

## HTTP Status Codes

| Situation | Code |
|-----------|------|
| Success (read/update) | 200 |
| Created | 201 |
| No content (delete) | 204 |
| Bad request / validation | 400 |
| Unauthenticated | 401 |
| Unauthorized (wrong tenant/role) | 403 |
| Not found | 404 |
| Conflict (duplicate) | 409 |
| Server error | 500 |

## Authentication

- All `/api/v1/*` routes require `Authorization: Bearer <jwt>`.
- JWT payload must include `{ userId, saasClientId, role }`.
- Token lifetime: 15 min access + 7 day refresh. Rotate refresh token on use.

## Rate Limiting

- Default: 100 req/min per IP.
- Authenticated routes: 500 req/min per `saasClientId`.
- Webhook endpoints: unlimited (protected by signature verification instead).

## Webhooks

- Verify Telegram signature via `X-Telegram-Bot-Api-Secret-Token`.
- Verify WhatsApp signature via `X-Hub-Signature-256`.
- Return `200 OK` immediately; process async via BullMQ.

## Applies to

`backend/routes/**/*.ts`, `backend/middleware/**/*.ts`
