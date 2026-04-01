---
name: nestjs-project-policy
description: >
  Project-specific NestJS architecture and implementation policy for the
  Checklist Execution System API. Use when creating modules, entities, DTOs,
  services, controllers, migrations, and transactional workflows. This skill
  supplements the installed external skills (`nestjs-best-practices` from
  kadajett and `nestjs-expert` from sickn33) — those cover general NestJS
  patterns and troubleshooting. This skill owns project-specific rules only.
---

# NestJS Project Policy — Checklist Execution System API

## When to Use This Skill

Use this skill when:
- Creating or modifying any NestJS module, entity, DTO, service, or controller in this project
- Implementing transactional workflows (instance creation, step completion)
- Writing or running TypeORM migrations
- Designing API endpoints or error responses
- Writing backend tests

For general NestJS patterns, DI, exception handling, and troubleshooting, defer to the
installed `nestjs-best-practices` and `nestjs-expert` skills first.

---

## Module Map

This API has six feature modules. Keep responsibilities within module boundaries:

| Module | Responsibility |
|---|---|
| `template` | Template CRUD |
| `template-step` | Step CRUD + gap-based position ordering + rebalancing |
| `instance` | Run creation, variable extraction/rendering, status lifecycle |
| `instance-step` | Step completion toggling, `next_step_id` advancement |
| `todo` | Standalone todo CRUD |
| `dashboard` | Read-only aggregation of in-progress runs + incomplete todos |

Each module has: `entity`, `service`, `controller`, and `module` files.
No business logic in controllers — all logic lives in services.

---

## Data Model

### Entities

Use TypeORM decorators. Follow these conventions:

```typescript
@Entity()
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- Use `@CreateDateColumn()` and `@UpdateDateColumn()` for timestamps
- Use `nullable: false` explicitly on required columns
- Enums are string-backed: `status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'`
- Store JSON (variables) as `@Column({ type: 'simple-json', nullable: true })`

### Instance Status Lifecycle

```
IN_PROGRESS → COMPLETED (auto when all steps done)
IN_PROGRESS → ABANDONED (manual)
```

Never allow transitions from COMPLETED or ABANDONED back to IN_PROGRESS.

### Delete Semantics

| Delete | Cascades to | Notes |
|---|---|---|
| Template | Template steps | Instances survive (they are self-contained snapshots) |
| Instance | Instance steps | Full cascade |
| Template step | Nothing | Instance steps are independent copies |

Use `onDelete: 'CASCADE'` on `@ManyToOne` relations where required.

---

## DTO and Validation

- Separate DTOs for create, update, and move operations
- All request DTOs use `class-validator` decorators
- All request DTOs are decorated with `@ApiProperty()` for Swagger
- Response shaping: return plain objects or response DTOs — do not leak ORM entities directly

```typescript
export class CreateTemplateDto {
  @ApiProperty({ example: 'Deployment Process' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

The global `ValidationPipe` is configured with `whitelist: true, forbidNonWhitelisted: true`.

---

## Service Layer Rules

- All multi-step mutations MUST use a TypeORM `QueryRunner` transaction
- Repository injection via `@InjectRepository(Entity)`
- Business rule logic (ordering, rendering, status transitions) lives in the service, not the controller
- Services expose typed return values — not raw `any`

---

## Project-Specific Workflow Rules

### Template Step Gap Ordering

Steps use integer gap positions (100, 200, 300, ...). When inserting between two steps:

```
newPosition = Math.floor((beforePosition + afterPosition) / 2)
```

**Rebalancing trigger**: if `newPosition === beforePosition` (gap < 1), rebalance all steps in the template:
- Query all steps ordered by position
- Reassign positions: `(index + 1) * 100`
- Wrap in a transaction

### Instance Creation (Transactional)

Order of operations within a single transaction:
1. Create and save the `Instance` (sets `next_step_id = null` initially)
2. Extract `{{variable}}` placeholders from all template steps (regex: `/\{\{(.*?)\}\}/g`)
3. Deduplicate variable names
4. Render each instruction by replacing placeholders with supplied values
5. Create and save all `InstanceStep` records
6. Set `instance.next_step_id` to the first step's ID
7. Save the instance again

Never set `next_step_id` before all steps exist — it would create a FK violation.

### Step Completion / next_step_id

When a step is toggled completed:
1. Update `instanceStep.completed` and `instanceStep.completedAt`
2. Find the first incomplete step ordered by `stepOrder`
3. Set `instance.next_step_id` to that step's ID (or `null` if all complete)
4. If all steps complete, set `instance.status = 'COMPLETED'`
5. All of the above in a single transaction

Step un-completion is supported — toggle back, recalculate next_step_id.

### Variable Extraction

```typescript
extractVariables(instructions: string): string[] {
  const matches = instructions.matchAll(/\{\{(.*?)\}\}/g);
  return [...new Set([...matches].map(m => m[1].trim()))];
}
```

### Today Dashboard Query

Use a single JOIN query via QueryBuilder:

```sql
SELECT i.id, i.name, i.status, s.id as stepId, s.title, s.renderedInstructions
FROM instance i
LEFT JOIN instance_step s ON s.id = i.next_step_id
WHERE i.status = 'IN_PROGRESS'
```

---

## API Conventions

- Global prefix: `/api` (set in `main.ts`)
- Base routes follow spec: `/api/templates`, `/api/instances`, `/api/todos`, `/api/dashboard`
- All controllers tagged with `@ApiTags()`
- Standard NestJS exception responses — use `NotFoundException`, `BadRequestException`, `ConflictException`
- Error response shape (NestJS default): `{ statusCode, message, error }`

---

## Migration Workflow

- Generate: `npm run migration:generate -- src/database/migrations/<Name>`
- Run: `npm run migration:run`
- `synchronize: false` — never use `synchronize: true` in any environment
- All schema changes go through migrations
- DataSource config at `src/database/data-source.ts`

---

## Testing Conventions

- Unit tests for services using mocked repositories (`jest.fn()`)
- Integration tests use a separate in-memory SQLite database
- Supertest for controller/HTTP layer tests
- Transaction-heavy workflows (instance creation, step completion) require integration tests
- Test files colocated: `*.spec.ts` beside the source file
- E2E tests in `test/` directory

---

## Anti-Patterns

- Do not return ORM entity objects directly from controllers without shaping
- Do not put business logic in controllers (ordering, rendering, status transitions)
- Do not use `synchronize: true`
- Do not run multi-step mutations without a transaction
- Do not push TypeORM query builder SQL into controllers

---

## Definition of Done (per feature)

- [ ] Request DTOs validated with `class-validator` + Swagger `@ApiProperty`
- [ ] Service uses transactions for multi-step mutations
- [ ] Delete cascades match the delete semantics table above
- [ ] Migration generated and runs cleanly
- [ ] Unit test for service logic
- [ ] Integration/Supertest for controller layer
- [ ] Swagger docs visible at `/api/docs`
