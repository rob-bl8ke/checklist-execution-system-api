# checklist-execution-system-api

NestJS REST API backend for the Checklist Execution System — a Runbook + Todo manager for engineers performing repeatable operational tasks.

## Prerequisites

- Node.js 22 (use `nvm use` to switch automatically)
- npm 10+
- NestJS CLI: `npm install -g @nestjs/cli`

## Tech Stack

- **Framework**: NestJS with TypeScript (strict mode)
- **ORM**: TypeORM
- **Database**: SQLite via `better-sqlite3`
- **Testing**: Jest + Supertest

## Local Development

```bash
# Install dependencies
npm install

# Start in watch mode
npm run start:dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e
```

The API starts on `http://localhost:3000`. The SQLite database file (`checklist.db`) is created on first startup.

## Project Structure

```
src/
  app.module.ts        # Root module with TypeORM config
  main.ts              # Entry point
  template/            # Template CRUD (Phase 2)
  template-step/       # Template step CRUD + ordering (Phase 2)
  instance/            # Run creation + variable rendering (Phase 3)
  instance-step/       # Step completion (Phase 3)
  todo/                # Standalone todo CRUD (Phase 4)
  dashboard/           # Today dashboard aggregation (Phase 5)
  database/migrations/ # TypeORM migration files
```

## Database

SQLite database file: `checklist.db` (excluded from git).

Migrations are managed via TypeORM CLI:

```bash
# Generate a migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```
