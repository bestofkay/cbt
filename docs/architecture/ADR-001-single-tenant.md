# ADR-001: Single-Tenant Deployment

## Status

Accepted

## Context

Original SaaS multi-tenant requirements were revised. The product is deployed as one organization per installation.

## Decision

- No `tenantId` column or tenant middleware.
- Global `Branding` and `PlatformSettings`.
- `Department` used only for internal org structure.

## Consequences

Simpler queries and auth. White-label is per-deployment configuration, not runtime tenant routing.
