# checklist-execution-system-api

NestJS REST API backend for the Checklist Execution System — a Runbook + Todo manager for engineers performing repeatable operational tasks.

> Part of the [Checklist Execution System](https://github.com/rob-bl8ke/checklist-execution-system-planning). See the planning repo for Docker Compose setup and architecture overview.

## Prerequisites

- Node.js 22 (use `nvm use` to switch automatically — `.nvmrc` is provided)
- npm 10+

## Tech Stack

- **Framework**: NestJS with TypeScript (strict mode)
- **ORM**: TypeORM 0.3
- **Database**: SQLite via `better-sqlite3`
- **Testing**: Jest
- **API docs**: Swagger UI at `/api/docs`

## Local Development

```bash
# Install dependencies
npm install

# Run migrations (required on first run or after a fresh clone)
npm run migration:run

# Start in watch mode
npm run start:dev
```

The API starts on `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/api/docs`.

The SQLite database file (`checklist.db`) is created in the project root and excluded from git.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the API listens on |
| `DB_PATH` | `checklist.db` | Path to the SQLite database file |

## Running Tests

```bash
# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:cov
```

127 tests across 12 test suites.

## Database Migrations

```bash
# Run pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Generate a new migration (after changing an entity)
npm run migration:generate -- src/database/migrations/MigrationName

# Show migration status
npm run migration:show
```

Migrations use `typeorm-ts-node-commonjs` and point at `src/database/data-source.ts` directly — no pre-build required for local dev.

## Project Structure

```
src/
  app.module.ts          # Root module — TypeORM config, DB_PATH env var
  main.ts                # Entry point — PORT env var
  migrate.ts             # Standalone migration runner for Docker CMD
  template/              # Template CRUD
  template-step/         # Template step CRUD + fractional ordering
  instance/              # Run creation + Mustache variable rendering
  instance-step/         # Step completion toggle
  todo/                  # Standalone todo CRUD
  dashboard/             # Today dashboard aggregation
  database/
    data-source.ts       # TypeORM DataSource (env-aware entity/migration paths)
    migrations/          # TypeORM migration files
```
