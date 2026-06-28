# Uniscope

Uniscope connects prospective medical students with verified current students and alumni to learn about universities through anonymous discussions, reviews, Q&A, and chat.

This repository is a **production-grade monorepo foundation**. Business features (auth, chat, reviews, APIs) are intentionally out of scope until later sprints.

## Repository structure

```
uniscope/
├── mobile/          # React Native + Expo (TypeScript)
├── backend/         # NestJS API (TypeScript) + Prisma
├── admin/           # Next.js admin portal (TypeScript)
├── docs/            # Product, architecture, standards, ADRs
├── infrastructure/  # Docker, deployment placeholders
├── .github/         # PR template, issue templates
├── README.md
└── CONTRIBUTING.md
```

## Tech stack

| Layer    | Technology        |
| -------- | ----------------- |
| Mobile   | React Native, Expo, TypeScript |
| Backend  | NestJS, TypeScript, Prisma |
| Database | PostgreSQL |
| Admin    | Next.js, TypeScript |

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+ (local or Docker)
- Expo Go app (for mobile dev) or iOS Simulator / Android emulator

## Quick start

```bash
# Install all workspace dependencies
npm install

# Copy environment files
cp backend/.env.example backend/.env
cp admin/.env.example admin/.env.local
cp mobile/.env.example mobile/.env

# Start PostgreSQL (see infrastructure/docker or local install)
# Then generate Prisma client
npm run prisma:generate --workspace=backend

# Run apps (separate terminals)
npm run dev:backend   # http://localhost:3001
npm run dev:admin     # http://localhost:3000
npm run dev:mobile    # Expo dev server
```

See [docs/development/local-setup.md](docs/development/local-setup.md) for full instructions.

## Documentation

| Topic | Location |
| ----- | -------- |
| Product overview | [docs/product/](docs/product/) |
| Architecture | [docs/architecture/](docs/architecture/) |
| Database | [docs/database/](docs/database/) |
| API (future) | [docs/api/](docs/api/) |
| Coding standards | [docs/standards/coding-standards.md](docs/standards/coding-standards.md) |
| Branch strategy | [docs/development/branch-strategy.md](docs/development/branch-strategy.md) |
| Environment variables | [docs/development/environment-variables.md](docs/development/environment-variables.md) |
| ADRs | [docs/decisions/](docs/decisions/) |
| Sprint 0 | [docs/sprints/sprint-0/](docs/sprints/sprint-0/) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Proprietary — Uniscope. All rights reserved.
