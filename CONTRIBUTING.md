# Contributing to Skybet

Skybet changes should preserve the project’s safety boundaries, TypeScript contracts, responsive behaviour, and auditability goals.

## First-commit workflow

Create a **private** GitHub repository named `skybet`. Do not commit `.env` files, database exports, provider credentials, KYC documents, customer data, or production logs. After reviewing the files, create the initial commit using the following workflow.

```bash
git init
git add .
git commit -m "chore: initialize Skybet foundation"
git branch -M main
git remote add origin git@github.com:OWNER/skybet.git
git push -u origin main
```

If the repository was created through GitHub first, clone it and copy the approved Skybet project files into the clone before committing. Keep the default branch protected, require review for production changes, and enable secret scanning where available.

## Pull-request standard

Every change should include a concise explanation, an updated `todo.md` entry, and relevant tests. Run the following before requesting review.

```bash
pnpm test
pnpm check
pnpm build
```

| Change type | Required review consideration |
| --- | --- |
| Customer UI | Mobile and desktop verification, keyboard navigation, visible focus state, and contrast. |
| Admin or referral logic | Role gate, validation, immutable audit event design, and a documented effective date. |
| Safety controls | Server-side enforcement, no marketing eligibility for restricted accounts, and a customer-facing explanation. |
| Database or provider code | Migration plan, rollback path, secret scope, and failure/health behaviour. |
| Deployment | Preview validation and an explicit production environment-variable review. |

## Branches and commits

Use focused branches such as `feat/admin-referral-controls` or `fix/mobile-selection-sheet`. Keep commit messages action-oriented, for example `feat: add role-aware referral rule editor`. Never merge a placeholder integration that exposes an operational button without a clear unavailable state.
