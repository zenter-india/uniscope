# Infrastructure

Deployment and local infrastructure assets for MedConnect.

## Contents

| Path | Purpose |
| ---- | ------- |
| [docker/](docker/) | Local PostgreSQL via Docker Compose |
| [deployment/](deployment/) | Placeholder for staging/production configs (future) |

## Future additions

- Terraform / Pulumi modules
- Kubernetes manifests or platform-specific configs
- GitHub Actions workflows (`.github/workflows/`)
- Monitoring and alerting definitions

## Environments

| Environment | Purpose | Config location |
| ----------- | ------- | --------------- |
| Local | Developer machines | `infrastructure/docker/` |
| Staging | Pre-production | TBD |
| Production | Live users | TBD |
