# /project:fix-issue — Fix a GitHub Issue

Investigate, implement, and verify a fix for a reported bug or feature request.

## Usage

```
/project:fix-issue <issue-number>
/project:fix-issue 42
```

## Workflow

### Step 1 — Read the issue
```bash
gh issue view $ARGUMENTS
```
Parse: title, description, steps to reproduce, expected vs actual behavior.

### Step 2 — Reproduce locally
- Identify the affected endpoint or bot command from the issue description.
- Run the backend in dev mode: `npm run dev`.
- Trigger the failing scenario and confirm the error.

### Step 3 — Root cause analysis
- Trace the request: route → middleware → service → DB.
- Check for missing tenant scope, unhandled async errors, or Claude API failures.
- Check recent git history for the affected file: `git log --oneline -10 -- <file>`.

### Step 4 — Implement fix
- Edit only the files required — no scope creep.
- Follow `.claude/rules/code-style.md` and `.claude/rules/api-conventions.md`.
- If the bug involves a missing test, add the test first (TDD).

### Step 5 — Verify
```bash
npm run lint:fix
npm test -- --testPathPattern="<affected-service>"
```

### Step 6 — Create PR
```bash
git checkout -b fix/issue-$ARGUMENTS
git add <changed-files>
git commit -m "fix: <short description> (closes #$ARGUMENTS)"
gh pr create --title "fix: <description>" --body "Closes #$ARGUMENTS"
```

## Common Fix Patterns

| Symptom | Likely cause | Fix location |
|---------|-------------|--------------|
| Data leaking across tenants | Missing `saasClientId` filter | `backend/services/*.ts` |
| 401 on valid token | JWT middleware not applied to new route | `backend/routes/*.ts` |
| Bot not responding | Unhandled Claude API error | `bots/telegram/bot_improved.py` |
| Webhook returns 500 | Async handler throwing without `next(err)` | `backend/routes/webhooks.ts` |
| Pipeline stage not updating | Socket.io room not scoped to tenant | `backend/socket/handlers.ts` |
