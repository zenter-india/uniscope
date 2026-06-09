# Architecture Decision Records (ADR)

We document significant technical decisions using lightweight ADRs.

## When to write an ADR

- Choosing a library or pattern with long-term impact
- Changing database, auth, or deployment strategy
- Deviating from documented standards

## Format

Each ADR is a markdown file:

```
docs/decisions/
├── README.md
├── 0001-monorepo-npm-workspaces.md
├── 0002-postgresql-prisma.md
└── template.md
```

### File naming

`NNNN-short-kebab-title.md` — four-digit sequence, zero-padded.

### Template

Use [template.md](template.md). Sections:

1. **Title** — short noun phrase
2. **Status** — Proposed \| Accepted \| Deprecated \| Superseded
3. **Context** — what forced the decision
4. **Decision** — what we chose
5. **Consequences** — positive, negative, neutral

## Process

1. Copy `template.md` to the next number.
2. Open PR with ADR and implementing code (if any).
3. Team reviews ADR content, not just code.
4. On merge, set status to **Accepted**.

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-monorepo-npm-workspaces.md) | Monorepo with npm workspaces | Accepted |
| [0002](0002-postgresql-prisma.md) | PostgreSQL with Prisma ORM | Accepted |
