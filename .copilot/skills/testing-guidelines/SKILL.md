---
name: testing-guidelines
description: >
  Project-specific testing strategy and conventions for the Checklist Execution
  System. Use when deciding what to test, how to structure tests, and how to set
  up test data. This skill supplements the installed external skills (`tdd` from
  mattpocock, `angular-testing` from analogjs, and `nestjs-best-practices` /
  `nestjs-expert` from kadajett/sickn33) — those cover general TDD workflow and
  framework test patterns. This skill owns project-specific test scope,
  fixtures, coverage rules, and phase-by-phase priorities.
---

# Testing Policy — Checklist Execution System

## When to Use This Skill

Use this skill when:
- Deciding what tests to write for a new service, controller, or component
- Setting up test data builders or fixtures
- Configuring a SQLite test database for NestJS integration tests
- Planning test coverage for a phase of implementation

For TDD workflow (red/green/refactor, vertical slices), defer to the `tdd` skill.
For Angular TestBed patterns, defer to `angular-testing`.
For NestJS test setup patterns, defer to `nestjs-best-practices` and `nestjs-expert`.

---

## Testing Philosophy

- **Vertical slices first** — prioritize tests for complete user-visible behaviors over internal unit coverage
- **Protect workflow logic** — transactional flows (instance creation, step completion) must be covered with integration tests; these are the highest-risk paths
- **Avoid framework noise** — don't write tests that only prove Angular's router works or TypeORM's save() method works
- **Deterministic** — tests must pass consistently; no date/time-sensitive assertions without mocking

---

## Test Pyramid for This Project

```
                  [ E2E smoke test ]          (Phase 11 — manual walkthrough only)
              [ Controller / Supertest ]      (integration: HTTP layer + DB)
          [ Service unit tests ]              (unit: mocked repos for fast logic tests)
      [ Angular component tests ]             (TestBed: render + interaction)
  [ Angular service tests ]                   (unit: mocked HttpClient)
```

---

## Phase-by-Phase Test Priorities

| Phase | Critical Tests |
|---|---|
| 2 — Templates & Steps | Template CRUD service, step position gap ordering, rebalancing trigger |
| 3 — Instances | Variable extraction, instance creation transaction, step completion advancement, status lifecycle |
| 4 — Todos | Todo CRUD service (low complexity) |
| 5 — Dashboard | Dashboard aggregation query returns correct shape |
| 6 — Frontend shell | Route navigation resolves to correct components |
| 7 — Templates UI | Template list renders, step editor updates title/instructions |
| 8 — Runs UI | Variable form generates correct fields, step completion toggle updates UI |
| 9 — Todos UI | Inline add, checkbox toggle, delete |
| 10 — Dashboard UI | Today cards render with correct step data |

---

## Backend Test Strategy

### Service Unit Tests

- Mock repositories with `jest.fn()` or `createMock()` from `@golevelup/ts-jest`
- Test: input validation logic, gap position calculation, variable extraction regex, status transitions
- Do NOT test TypeORM internals — only test your business logic

```typescript
describe('TemplateStepService', () => {
  it('calculates midpoint position between two steps', () => {
    expect(service.calculatePosition(200, 300)).toBe(250);
  });

  it('triggers rebalance when gap is less than 1', async () => {
    // ...
  });
});
```

### Integration Tests (Supertest + SQLite)

- Use a separate in-memory SQLite database: `database: ':memory:'`
- Create a `TestModule` with real TypeORM + real services
- Tear down the database between tests using `beforeEach` / `afterEach`
- Cover: instance creation (full transaction), step completion, cascade deletes

```typescript
beforeAll(async () => {
  app = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [...],
        synchronize: true,
      }),
      // feature modules...
    ],
  }).compile();
});
```

### Critical Integration Test Cases

| Scenario | Why |
|---|---|
| Create instance with variables | Tests transaction, variable rendering, next_step_id FK ordering |
| Complete last step | Tests auto-COMPLETED status transition |
| Un-complete a step | Tests next_step_id recalculation |
| Delete template with instances | Tests that instances survive (self-contained snapshots) |
| Move step into gap < 1 | Tests rebalancing trigger |

---

## Frontend Test Strategy

### Component Tests

- Use `TestBed.configureTestingModule` with `imports: [ComponentUnderTest]`
- Provide mock services with `{ provide: RealService, useValue: mockService }`
- Test: component renders with correct initial state, user interactions trigger expected outputs
- Do NOT test Angular Material internal rendering — test your component logic

```typescript
it('should display run name from input', () => {
  fixture.componentRef.setInput('run', { name: 'Deploy v1.5', ... });
  fixture.detectChanges();
  const el = fixture.nativeElement.querySelector('[data-testid="run-name"]');
  expect(el.textContent).toContain('Deploy v1.5');
});
```

### Service Tests

- Mock `HttpClient` using `HttpClientTestingModule` and `HttpTestingController`
- Test: correct URL called, correct request body, correct response mapping

### What NOT to Test

- Angular routing internals (RouterTestingModule wiring)
- TypeORM `save()` / `find()` method behavior
- Angular Material component rendering details
- Tailwind CSS class application

---

## Test Data Builders

Use builder functions (not large JSON fixtures) to create test entities:

```typescript
export function buildTemplate(overrides?: Partial<Template>): Template {
  return {
    id: 1,
    name: 'Test Template',
    description: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildInstance(overrides?: Partial<Instance>): Instance {
  return {
    id: 1,
    templateId: 1,
    name: 'Test Run',
    variables: {},
    status: 'IN_PROGRESS',
    nextStepId: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}
```

Place builders in: `src/test/builders/` (backend), `src/app/test/builders/` (frontend).

---

## Naming and Placement Conventions

```
# Backend
src/
  template/
    template.service.spec.ts         # unit test
    template.controller.spec.ts      # Supertest integration test

# Frontend
src/app/
  pages/today/
    today.component.spec.ts          # TestBed component test
  services/
    template.service.spec.ts         # HttpClient service test
```

Test `describe` blocks use the class/function name.
Test `it` blocks describe observable behavior: `'should return 404 when template not found'`.

---

## Coverage Rules

| Area | Minimum coverage target |
|---|---|
| Service workflow logic (instance creation, step completion, ordering) | 90%+ branch coverage |
| Service CRUD operations | 70%+ |
| Controllers | 80%+ line coverage via Supertest |
| Angular components (pages) | render + primary interaction |
| Angular services | URL + response mapping |

Run coverage: `npm run test:cov` (NestJS) / `ng test --code-coverage` (Angular).

---

## Anti-Patterns

- Large brittle snapshot tests for Angular component HTML
- Testing every branch of TypeORM's query builder
- Mocking so much that the test doesn't prove the workflow works end-to-end
- Using real production SQLite file for integration tests (use `:memory:`)
- Non-deterministic test data (use `new Date('2026-01-01')` not `new Date()`)
- `it.only` or `describe.only` committed to the repo

---

## Definition of Done (per test suite)

- [ ] All tests pass without environment-specific setup after `npm install`
- [ ] Test database uses `:memory:` SQLite — no file left on disk
- [ ] No `it.only` or `describe.only` in committed code
- [ ] Builder functions used for test entities (not hardcoded raw objects)
- [ ] Critical workflow paths (instance creation, step completion) covered by integration tests
