---
name: Playwright
description: Use when running E2E checks or debugging the web app with Playwright MCP, especially when you need to (1) ensure the demo user exists with superadmin permissions via demo.sql, and (2) login via /demoLogin on localhost.
---

## Quick start (demo user + login)

1) Run `demo.sql` to recreate `demo@demo.com` as **active superadmin** (and enable all roles).

From `packages/backend-my-training-app/`:

```bash
set -a
source .env.development  # if your file is named ".env.developement", fix the filename or change this line
set +a
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f ../../.claude/skills/playwright/demo.sql
```

2) Login in the UI:
- URL: `http://localhost:5173/demoLogin`
- Email: `demo@demo.com`
- Password: `appleTesting123`

## Notes

- `demo.sql` is safe to re-run; it deletes and recreates the demo user each time.