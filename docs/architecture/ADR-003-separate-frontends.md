# ADR-003: Separate Frontend Portals

## Status

Accepted

## Context

Admin, candidate, and proctor workloads have different security postures and UX flows.

## Decision

Ship three Vite apps:

- `web-admin` (port 5173)
- `web-candidate` (port 5174)
- `web-proctor` (port 5175)

Shared design system lives in `packages/ui`.

## Consequences

Independent deploy units and clearer auth boundaries at the cost of duplicated app shells.
