# AGENTS.md — Gestor Patrimonial

## Quick start

```bash
# dev (SQLite, no Docker needed)
npm install
cp .env.example .env   # adjust DATABASE_URL to file:./db/wealth.db
npx prisma db push     # create tables
npm run dev

# production (Docker + PostgreSQL)
docker compose up -d --build
```

## Build / Test / Lint

```bash
npm run lint      # next lint — no `npm run typecheck`, rely on `next build`
npm run build     # includes type-checking via Next.js
```

There are **no test files** in the project. Verification is manual via dev server.

## Database

- **PostgreSQL** (Docker) via `prisma/schema.postgres.prisma`
- **SQLite** fallback via `prisma/schema.prisma`
- Docker build copies `schema.postgres.prisma` → `schema.prisma` before `prisma generate`
- Balance updates happen **in application code** (API routes), not via DB triggers
- Sign convention: positive amount = income, negative = expense

### Key Prisma commands

```bash
npx prisma db push          # apply schema (no migration files)
npx prisma generate          # regenerate client
npx prisma studio            # GUI data browser
```

No migration history — uses `db push` directly. Schema changes are applied in-place.

## Architecture

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Auth | NextAuth v4 (credentials provider, JWT, single admin user) |
| DB | Prisma ORM + PostgreSQL (Docker) or SQLite |
| Styling | Tailwind CSS 3, custom dark theme, custom spacing/sizing scale |
| Icons | Material Symbols (Google Fonts) |
| i18n | Simple JSON dictionary (`src/messages/es.json`), `t()` function |
| Charts | Custom SVG components (`DonutChart`, `BarChart`) |
| State | Local `useState` + `useEffect`, one React Context (`ViewContext`) |

### Route structure

```
/ → redirect to /login
/login
/(dashboard)     ← route group, requires auth
  /dashboard
  /matrix
  /transactions
  /quick-entry
  /settings
    /settings/banks
    /settings/mapping-rules
    /settings/import
```

### API pattern (every protected route)

```ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // …
}
```

### Navigation

- `TopAppBar.tsx` defines `navItems` array — add new pages here
- Desktop: left sidebar (56px, `hidden md:flex`)
- Mobile: bottom nav (only shows "Rápido" tab on <768px)
- All pages are "use client" with `fetch()` in `useEffect`

### Data model

```
Bank (name, iban, balance)
  └── Account (label, iban, balance, interest_rate/period)
        └── Transaction (concept, amount, bank_id, account_id, group, type,
                         is_recurring, recurring_period)
MappingRule (pattern, default_bank, default_group, default_type)
```

## Conventions

- **All components are `"use client"`** — no server components
- **No comments** in code per project convention
- **No form libraries** — inline `useState` for form state
- **No test setup** — manual testing only
- **Balance updates** happen inline in API routes (create/update/delete)
- **Amount sign** applied via `applySign(amount, group)` — income groups get positive, everything else negative
- **Spanish locale** for number formatting (`toLocaleString("es")`)

### Tailwind custom tokens

Use the project's custom spacing/sizing scale instead of Tailwind defaults:

- `px-container-margin` (16px), `gap-gutter` (12px)
- `p-xs` (4px), `p-sm` (8px), `p-md` (12px), `p-lg` (16px), `p-xl` (24px)
- `text-display-lg`, `text-headline-md`, `text-body-md`, `text-body-sm`, `text-label-caps`, `text-data-mono`
- `bg-surface`, `bg-surface-container`, `bg-surface-container-low`, etc.
- `text-positive` (#10B981), `text-critical` (#F59E0B)
- `border-outline-variant` / `border-[#2D3748]`

### i18n

All UI strings in `src/messages/es.json`. Access via `t("namespace.key")`.

## Docker quirks

- `prisma generate` happens at build time; runtime runs `prisma db push`
- OpenSSL symlink workaround needed for Alpine: `ln -sf /usr/lib/libssl.so.3 /usr/lib/libssl.so.1.1`
- Standalone Next.js output (`next.config.mjs` sets `output: "standalone"`)
- DB password shared between `DATABASE_URL` and `DB_PASSWORD` env vars
- Auto-login: admin/admin by default (configurable via env)

## Path aliases

`@/*` maps to `./src/*` — use `@/components/...`, `@/lib/...`, etc.
