# Code Style Rules

## TypeScript

- Strict mode enabled — no implicit `any`.
- Prefer `interface` over `type` for object shapes; use `type` for unions and primitives.
- Use `const` by default; `let` only when mutation is necessary.
- Async functions must return typed promises: `Promise<Lead>` not `Promise<any>`.
- Never use `!` non-null assertion without a comment explaining why it's safe.

## Naming

- Files: `kebab-case.ts` for modules, `PascalCase.ts` for React components.
- Variables/functions: `camelCase`.
- Types/interfaces/classes: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for module-level config only.
- Database columns: `snake_case` (Prisma maps to camelCase in code).

## Multi-Tenancy Guard

Every service method that queries the database must accept `saasClientId` as a parameter and include it in every `WHERE` clause. No exceptions.

```ts
// Correct
async getLeads(saasClientId: string, filters: LeadFilters) {
  return prisma.salesLead.findMany({ where: { saasClientId, ...filters } });
}

// Wrong — missing tenant scope
async getLeads(filters: LeadFilters) {
  return prisma.salesLead.findMany({ where: filters });
}
```

## Error Handling

- Use typed error classes (`AppError`, `AuthError`, `NotFoundError`) in `backend/errors/`.
- Express routes must pass errors to `next(err)` — never swallow with empty catch.
- Claude API errors: retry once with exponential backoff; log the attempt.

## Imports

- Use path aliases (`@/services/lead`) configured in `tsconfig.json` — no `../../..` relative paths.
- Group imports: Node built-ins → third-party → internal aliases → relative.

## Formatting

- Prettier with default settings; enforced via `npm run lint`.
- Max line length: 100 characters.
- Trailing commas in multi-line structures.

## Applies to

`backend/**/*.ts`, `frontend/**/*.ts`, `frontend/**/*.tsx`
