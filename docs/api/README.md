# API documentation

## Status

**Sprint 0:** No business APIs. Only infrastructure endpoints exist.

## Available endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | NestJS default hello (starter) |
| GET | `/health` | Service health check |

Base URL (local): `http://localhost:3001`

## Future documentation

When APIs are implemented, document here:

- OpenAPI / Swagger spec location
- Authentication scheme
- Versioning strategy (`/v1/...`)
- Error response format
- Pagination conventions

## Client configuration

| App | Env variable | Default |
| --- | ------------ | ------- |
| Mobile | `EXPO_PUBLIC_API_URL` | `http://localhost:3001` |
| Admin | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |
