# /project:review — Revisión de código

Revisión estructurada de la rama actual o de un path específico.

## Uso
```
/project:review [path]
/project:review admin-panel/src/app/api/shop/orders
```
Sin path: revisa el diff de la rama actual vs `main`.

## Pasos
1. `git diff main...HEAD -- $ARGUMENTS`
2. Lanzar el agente `code-reviewer` con el diff (checklist multi-tenant, e-commerce, pagos).
3. Si toca auth, pagos o webhooks → lanzar también `security-auditor`.
4. Validación técnica: `cd admin-panel && npx tsc --noEmit` y `npx prisma validate` si cambió el schema.

## Salida por hallazgo
**archivo:línea** — qué se encontró · Severidad `CRITICAL|WARNING|INFO` · regla violada (`.claude/rules/...`) · fix sugerido en un bloque de diff.
