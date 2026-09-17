# Fragrance Chemistry

Unified olfactory formulation lab, encyclopedia, and supply-chain platform.

## Stack

- **Web**: Vite + React + TypeScript + Zustand + TanStack Query (+ Capacitor / PWA)
- **API**: NestJS + Drizzle ORM + BullMQ
- **DB**: PostgreSQL 18 (RLS on `lab.*`)
- **Cache**: Redis (db1, ACL prefix `fc:`)
- **Shared calc**: `@fc/formula-engine` (client + server)

## Prerequisites

- Node.js ≥ 20
- pnpm 10 (`npx pnpm@10` or corepack)
- Access to Postgres / Redis credentials in a local `.env` (never commit)

## Setup

```bash
cp .env.example .env
# fill in credentials

npx pnpm@10 install
npx pnpm@10 db:bootstrap      # once: extensions, schemas, runtime role
npx pnpm@10 redis:bootstrap   # once: ACL user; then paste snippet into redis.conf
npx pnpm@10 db:migrate
npx pnpm@10 db:seed
npx pnpm@10 dev               # web :5173 + api :3000
```

## Manual ops (one-time)

1. Paste `infra/redis/redis.conf.snippet` into the server `redis.conf` and restart Redis (ACL survives reboot).
2. Enable GitHub **secret scanning push protection** (Settings → Code security).
3. `gh auth login` before the first push.

## Workspace layout

```
apps/web                 Vite React PWA
apps/api                 NestJS API
packages/shared          Shared DTOs / types
packages/formula-engine  Pure calculation engine
packages/scale-bridge    Scale drivers (Web Serial / BLE)
infra/db                 DB bootstrap + migrations
infra/redis              Redis ACL bootstrap
infra/git-hooks          Secret guard for public repo
```

## Plans

Free (≤3 formulas) · Pro · Enterprise (supplier listings)

## License

MIT
