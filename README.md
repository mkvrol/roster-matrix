# Roster Matrix

**NHL Contract Value Analytics Platform** — Know what every player is worth.

Roster Matrix is a full-stack analytics platform that evaluates NHL player contract value using a proprietary 0–99 scoring engine. Built for General Managers, Agents, Scouts, and Executives who need data-driven contract intelligence.

## Screenshots

> _Screenshots coming soon._

---

## Tech Stack

| Layer         | Technology                                        |
| ------------- | ------------------------------------------------- |
| Framework     | Next.js 14 (App Router)                           |
| Language      | TypeScript                                        |
| API           | tRPC v11                                          |
| Database      | PostgreSQL 16 + Prisma ORM                        |
| Auth          | NextAuth.js (Google OAuth + Credentials)          |
| State         | TanStack Query (via tRPC), Zustand                |
| Styling       | Tailwind CSS (custom dark theme design system)    |
| Charts        | Recharts                                          |
| Caching       | Redis 7 (optional)                                |
| CI/CD         | GitHub Actions → GHCR Docker images               |
| Deployment    | Docker (multi-stage build)                        |

## Features

- **Value Score Engine** — Proprietary 0–99 scoring across production, efficiency, durability, and age curve
- **Contract Explorer** — Filter, sort, and analyze every active NHL contract with trade clause tracking
- **Cap Space Tracker** — Real-time salary cap tracking with multi-year projections
- **Trade Analyzer** — Model trade scenarios with instant cap impact and value fairness analysis
- **Player Comparison** — Side-by-side radar chart comparisons across all scoring components
- **Watchlists** — Personalized player tracking with automated value change alerts
- **Reports** — Generate and export PDF reports for meetings and presentations
- **League Overview** — League-wide standings, positional rankings, and team value breakdowns
- **Real-time Notifications** — SSE-powered notification system for score changes and trade alerts
- **Role-Based Access** — ADMIN > GM > ANALYST > SCOUT > VIEWER hierarchy with route protection

---

## Local Development Setup

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker** and **Docker Compose** (for database)
- **PostgreSQL 16** (or use Docker)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/roster-matrix.git
cd roster-matrix
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the database

```bash
docker compose up postgres redis -d
```

This starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. At minimum, set:

- `DATABASE_URL` — already configured for the Docker PostgreSQL instance
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- Google OAuth credentials (or use credentials auth for development)

### 5. Initialize the database

```bash
# Run migrations
npx prisma migrate dev

# Seed with sample data (32 teams, 800+ players, 4 seasons)
npx prisma db seed
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Explore the database (optional)

```bash
npx prisma studio
```

Opens Prisma Studio at [http://localhost:5555](http://localhost:5555).

---

## Environment Variables

| Variable              | Required | Default                          | Description                           |
| --------------------- | -------- | -------------------------------- | ------------------------------------- |
| `DATABASE_URL`        | ✅       | —                                | PostgreSQL connection string          |
| `NEXTAUTH_URL`        | ✅       | —                                | App URL (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET`     | ✅       | —                                | Session encryption secret             |
| `GOOGLE_CLIENT_ID`    | ❌       | —                                | Google OAuth client ID                |
| `GOOGLE_CLIENT_SECRET`| ❌       | —                                | Google OAuth client secret            |
| `REDIS_URL`           | ❌       | `redis://localhost:6379`         | Redis connection string               |
| `NODE_ENV`            | ❌       | `development`                    | Environment mode                      |
| `APP_VERSION`         | ❌       | `0.1.0`                          | Displayed in health check             |
| `NHL_API_BASE_URL`    | ❌       | `https://api-web.nhle.com`       | NHL API base URL                      |
| `RATE_LIMIT_MAX`      | ❌       | `100`                            | Max API requests per window           |
| `RATE_LIMIT_WINDOW_MS`| ❌       | `60000`                          | Rate limit window in ms               |

---

## Database Scripts

```bash
# Run migrations (development — creates migration files)
npm run db:migrate

# Run migrations (production — applies existing migrations)
npm run db:migrate:deploy

# Seed the database
npm run db:seed

# Backup the database
npm run db:backup

# Open Prisma Studio
npm run db:studio
```

### Seed Script

The seed script (`prisma/seed.ts`) populates the database with:

- 32 NHL teams with full metadata
- 800+ players (stars, starters, and depth)
- 4 seasons of stats per player (2022–23 through 2025–26)
- Season stats, advanced analytics, goalie stats
- Value scores with all scoring components
- Contracts with AAV, term, trade clauses, and structure

To re-seed from scratch:

```bash
npx prisma migrate reset   # Drops DB, re-runs migrations, then seeds
```

---

## Data Sync

To trigger an NHL data sync (fetches latest stats from the NHL API):

```bash
# Via the API (requires authentication)
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <token>"
```

Or use the Admin panel at `/admin` in the app (requires ADMIN role).

---

## Deployment

### Docker

Build and run with Docker Compose:

```bash
# Development
docker compose up --build

# Production
docker compose -f docker-compose.prod.yml up --build -d
```

### Manual Docker Build

```bash
docker build -t roster-matrix .
docker run -p 3000:3000 --env-file .env.production roster-matrix
```

### CI/CD Pipeline

The project includes GitHub Actions workflows:

| Workflow     | Trigger           | Actions                                       |
| ------------ | ----------------- | --------------------------------------------- |
| **CI**       | PR to `main`      | Lint, type check, run tests                   |
| **Build**    | Push to `main`    | Build & push Docker image to GHCR             |
| **Deploy**   | Release tag `v*`  | Build production image, run migrations, deploy |

### Creating a Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the deploy workflow which builds the production Docker image, pushes to GHCR, and runs database migrations.

### Health Check

The app exposes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Returns:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-02-22T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 2
    }
  },
  "responseTimeMs": 3
}
```

---

## Project Structure

```
roster-matrix/
├── .github/workflows/     # CI/CD pipelines
├── prisma/
│   ├── migrations/        # Database migrations
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed script
│   └── seed-data.ts       # Seed data (teams, players)
├── scripts/
│   ├── db-migrate.sh      # Migration runner
│   ├── db-seed.sh         # Seed runner
│   └── db-backup.sh       # pg_dump backup
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── api/           # API routes (tRPC, health, sync, etc.)
│   │   ├── dashboard/     # Command center
│   │   ├── players/       # Player search & detail
│   │   ├── contracts/     # Contract explorer
│   │   ├── trade-analyzer/# Trade scenario builder
│   │   ├── compare/       # Player comparison
│   │   ├── watchlist/     # Watchlists
│   │   ├── reports/       # Saved reports
│   │   ├── league-overview/# League-wide analytics
│   │   ├── admin/         # Admin panel
│   │   └── settings/      # User settings
│   ├── components/        # React components
│   ├── lib/               # Utilities, Prisma client, tRPC, SSE
│   ├── server/            # tRPC routers, auth config
│   └── types/             # TypeScript type definitions
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Development services
├── docker-compose.prod.yml# Production services
└── package.json
```

---

## License

Proprietary. All rights reserved.
