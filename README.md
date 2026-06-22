# Fleetpass

Australian B2B SaaS for daily light-vehicle prestart compliance and defect management.

**Start here:** `docs/fleetpass-build-plan.md` (product) and `docs/fleetpass-architecture.md` (engineering) are the canonical specs. Read both before touching code.

## Repo layout

- `marketing/` — the public landing page (deployed as its own Firebase Hosting target)
- `apps/worker/` — offline-first PWA, the prestart flow
- `apps/dashboard/` — supervisor / admin / mechanic PWA
- `apps/console/` — vendor back-office (platform-admin only)
- `packages/shared/` — TypeScript types + the checklist cascade resolver, imported by every app and by `functions/`
- `functions/` — Cloud Functions (provisioning, billing webhooks, digests, exports)
- `seed/` — Admin SDK scripts that seed the emulator with test orgs (Northern Star, Gold Fields)
- `docs/` — the two planning documents above

## Status

Marketing site: built. Everything else: not yet scaffolded — see `docs/fleetpass-architecture.md` §9 for the build order (slice 1 first).
