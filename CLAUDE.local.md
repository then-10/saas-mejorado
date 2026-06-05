# CLAUDE.local.md — Developer Local Overrides

> This file is gitignored. Add your personal dev environment notes here.

## Local Database

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/saas_mejorado_dev
REDIS_URL=redis://localhost:6379
```

## Personal Commands Override

```bash
# Use local Python venv
cd bots/telegram && source .venv/bin/activate && python bot_improved.py
```

## Notes

- Add any local quirks, personal API tokens (test keys only), or env-specific notes here.
- These settings are only active on this machine and are never committed.
