# Contributing to Uniscope

Thank you for helping build Uniscope. This guide covers how we work in the monorepo during the foundation and early product phases.

## Before you start

1. Read the [README](README.md) and [local setup](docs/development/local-setup.md).
2. Review [coding standards](docs/standards/coding-standards.md) and [naming conventions](docs/standards/naming-conventions.md).
3. Follow the [branch strategy](docs/development/branch-strategy.md).

## Branch workflow

1. Branch from `develop` (or `main` for hotfixes).
2. Use prefixes: `feature/`, `bugfix/`, `hotfix/`.
3. Keep PRs focused and small.
4. Open a PR using the [pull request template](.github/pull_request_template.md).

## Commit messages

Use clear, imperative subjects:

```
feat(mobile): add navigation shell placeholder
fix(backend): correct health check response shape
docs: document environment variable strategy
chore(infra): add docker compose for postgres
```

Scopes: `mobile`, `backend`, `admin`, `docs`, `infra`.

## Pull requests

- Link related issues.
- Fill out the PR template completely.
- Ensure CI passes (when configured).
- Request review from at least one teammate.
- Squash merge unless otherwise agreed.

## Architectural decisions

Significant technical choices require an [ADR](docs/decisions/README.md) in `docs/decisions/`.

## What not to merge (yet)

During Sprint 0 / foundation:

- Authentication or authorization flows
- Chat, reviews, or Q&A business logic
- Production API endpoints beyond health checks
- Unreviewed database schema for domain models

## Code review expectations

Reviewers should check:

- Scope matches the issue/PR description
- No secrets in code or commits
- Types and naming follow conventions
- `.env.example` updated when env vars change
- Tests added when behavior is introduced (future sprints)

## Getting help

Open a [Task issue](.github/ISSUE_TEMPLATE/task.yml) for process questions or use team channels as defined by your squad lead.
