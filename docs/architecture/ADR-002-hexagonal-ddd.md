# ADR-002: Hexagonal + DDD Modules

## Status

Accepted

## Context

Need maintainable Fortune-500 grade modularity across exam, identity, and proctoring domains.

## Decision

Each bounded context in `apps/api` exposes:

- `domain/` — entities, value objects, domain services, events
- `application/` — use cases / application services
- `infrastructure/` — Prisma repositories, storage adapters, SMTP
- `interfaces/` — Fastify HTTP routes and WebSocket handlers

Shared kernel lives in `packages/domain` and `packages/shared`.

## Consequences

Clear testability and replaceable adapters. Slightly more boilerplate than a flat MVC layout.
