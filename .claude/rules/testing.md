# Testing Rules

## Framework

Jest with `ts-jest` for TypeScript transpilation. Config lives in `jest.config.ts`.

## File Naming

- Unit tests: `*.test.ts` alongside the source file.
- Integration tests: `*.integration.test.ts` in `backend/__tests__/`.
- E2E tests: `*.e2e.test.ts` in `tests/e2e/`.

## What to Test

### Must test
- All service layer functions (business logic).
- JWT middleware (valid token, expired token, missing token, wrong tenant).
- Lead qualification pipeline (AI response parsing + DB state changes).
- Multi-tenancy isolation — a request scoped to tenant A must never return tenant B data.

### Do not test
- Prisma model internals (tested by the ORM itself).
- Express route wiring (covered by integration tests).
- Third-party API responses (mock at the client boundary).

## Mocking Policy

- **Mock** external APIs: Anthropic Claude, Telegram, WhatsApp Evolution API, Bitrix24.
- **Do not mock** the database in integration tests — use a real test PostgreSQL instance with a `_test` suffix database.
- Use `jest.spyOn` for mocking service dependencies in unit tests.

## Multi-Tenancy in Tests

Every integration test that touches the database must:
1. Create a test `saas_client` record in `beforeAll`.
2. Scope all fixtures to that client ID.
3. Clean up in `afterAll` using a transaction rollback or `prisma.$executeRaw('TRUNCATE ...')`.

## Coverage Targets

| Area | Minimum |
|------|---------|
| Services | 80% |
| Middleware | 90% |
| Utils | 70% |
| Routes (integration) | 70% |

Run `npm test -- --coverage` to check.

## Claude API Tests

Tests that exercise Claude AI must mock `anthropic.messages.create`. Use the fixture in `tests/fixtures/claude-response.json` for consistent snapshots.

## Applies to

`backend/**/*.test.ts`, `backend/__tests__/**`, `tests/**`
