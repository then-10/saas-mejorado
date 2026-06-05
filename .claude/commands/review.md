# /project:review — Code Review Command

Run a structured code review of the current branch or a specified file/directory.

## Usage

```
/project:review [path]
/project:review backend/routes/leads.ts
/project:review backend/services/
```

If no path is given, reviews all changes in the current branch vs `main`.

## What This Command Does

1. **Diff analysis**: `git diff main...HEAD -- $ARGUMENTS`
2. **Security check**: Scan for hardcoded secrets, SQL injection risks, missing tenant scoping.
3. **Style check**: Validate against `.claude/rules/code-style.md` and `.claude/rules/api-conventions.md`.
4. **Test coverage**: Confirm every new service function has a corresponding test file.
5. **Multi-tenancy audit**: Every DB query must filter by `saasClientId`.
6. **Claude API usage**: Verify error handling and retry logic on `anthropic.messages.create` calls.

## Output Format

For each finding, report:
- **File:Line** — what was found
- **Severity**: `CRITICAL` | `WARNING` | `INFO`
- **Rule violated** (links to `.claude/rules/`)
- **Suggested fix** (concise, one diff block)

## Examples of Findings

- `CRITICAL` — JWT middleware missing on new `/api/v1/reports` route
- `WARNING` — `prisma.salesLead.findMany` call missing `where: { saasClientId }` scope
- `INFO` — Function name does not follow camelCase convention

## Shell Steps

```bash
git diff main...HEAD -- $ARGUMENTS
npm run lint -- --quiet
npm test -- --passWithNoTests --testPathPattern="$ARGUMENTS"
```
