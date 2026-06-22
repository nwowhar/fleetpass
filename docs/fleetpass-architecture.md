# Fleetpass — Technical / Code Architecture

*Companion to `fleetpass-build-plan.md`. The build plan is the **product**; this is the **engineering** translation — how each section becomes repo structure, data, rules, functions, and a buildable order. Section references (§) point back to the build plan.*
*Last updated: 20 June 2026*

---

## 0. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** (apps, functions, shared) | one type model from client to server; the schema is enforced, not hoped for |
| Frontend | **React + Vite** (SPA PWAs) | matches the prototype; Vite has first-class PWA tooling; SPA suits an offline app behind auth (no SSR to fight) |
| Styling | **Tailwind** | maps cleanly onto the design tokens (§22) when we lock them |
| Data/offline | **Firestore** (modular SDK v10+) with IndexedDB persistence | offline is the decider (§9) |
| Files | **Firebase Storage** | photos, org/site-scoped (§8) |
| Auth | **Firebase Auth** — Entra SSO + email-link (supervisors/admins); custom device tokens (workers) | §3, §12 |
| Server | **Cloud Functions** (2nd gen, TS) | provisioning, billing webhooks, notifications, digests |
| Hosting | **Firebase Hosting**, multi-target | marketing + worker + dashboard + console |
| Region | **`australia-southeast1` (Sydney)** | onshore residency (§12) |
| Monorepo | **pnpm workspaces** | shared types package across apps + functions |

*Override notes:* if you'd rather Vue/Svelte, the repo shape and the entire data/rules/functions layer are unchanged — only `apps/*` differ. Next.js is deliberately avoided: its SSR strengths don't help an offline, auth-gated app and add complexity.

---

## 1. Repo structure

```
fleetpass/
├─ apps/
│  ├─ worker/            # offline-first PWA — the prestart flow (§3 worker surface)
│  ├─ dashboard/         # installable PWA — supervisor + admin + mechanic, role-routed (§14)
│  └─ console/           # vendor back-office, platformAdmin-gated (§15)
├─ marketing/            # the existing landing page (index.html) (§23)
├─ packages/
│  └─ shared/            # types, constants, cascade resolver, validators — imported everywhere
├─ functions/            # Cloud Functions (TS)
├─ seed/                 # Admin-SDK seed scripts (Northern Star, Gold Fields orgs)
├─ firestore.rules
├─ firestore.indexes.json
├─ storage.rules
├─ firebase.json         # hosting targets + emulator config
├─ .firebaserc           # dev / prod project aliases
└─ package.json          # pnpm workspaces
```

`packages/shared` is the spine: every app and the functions import the same interfaces, so a field rename surfaces as a compile error across the whole system rather than a runtime surprise. Vendor console is a **separate app** rather than a route in the dashboard, so a customer bundle never ships platform-admin code — smaller blast radius.

---

## 2. Shared domain model (`packages/shared/src/types.ts`)

The canonical schema. Everything else references these. (`Timestamp` = Firestore Timestamp.)

```typescript
// ---- Identity & claims (carried in the Firebase token) ----
export type Role = 'worker' | 'mechanic' | 'supervisor' | 'admin';

export interface FleetpassClaims {
  orgId: string;
  role: Role;
  siteIds?: string[];      // workers: scoped sites (usually one). Org roles: omit = all sites.
  deviceId?: string;       // worker device tokens only — enables targeted revocation
  platformAdmin?: boolean; // Fleetpass staff only
}
// Claims stay well under Firebase's 1000-byte limit; siteIds is a short array.

// ---- Org / Site ----
export type PlanId = 'intro' | 'lv10' | 'lv20' | 'lv30' | 'enterprise';

export interface Org {
  name: string;
  abn?: string;
  billing: {
    stripeCustomerId?: string;
    plan: PlanId;
    status: 'trial' | 'active' | 'past_due' | 'suspended';
    vehicleCap: number;        // soft cap for the band (§15) — warn, never block
    trialEndsAt?: Timestamp;
  };
  branding?: { logoPath?: string; colour?: string };  // tenant co-branding (§22)
  createdAt: Timestamp;
}

export interface Site {
  orgId: string;             // denormalised (see §4 — collection-group queries)
  name: string;
  timezone: string;          // e.g. 'Australia/Perth'
  network?: { label: string }; // optional on-site-sync flag (§13)
  createdAt: Timestamp;
}

// ---- Checklist engine (type-driven, §8) ----
export type ItemType = 'passfail' | 'photo' | 'number' | 'text';

export interface SeverityCategory {
  id: string;                // stable key referenced by items
  label: string;             // 'Category A', 'Fire Hazards' ...
  colour: string;            // hex — always paired with an icon (colour-blind safe, §22)
  groundsVehicle: boolean;   // a fail here tags the vehicle out
  requiresSignoff: boolean;  // clearing needs a sign-off
  order: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  type: ItemType;
  categoryId: string;        // -> SeverityCategory.id
  group?: string;            // optional sub-heading in a category ('FIRE HAZARDS')
  required: boolean;
  photoRequired?: boolean;
  order: number;
}

export interface ChecklistTemplate {
  name: string;
  scope: 'org' | 'site' | 'vehicleType';
  vehicleType?: string;      // when scope === 'vehicleType'
  categories: SeverityCategory[];
  items: ChecklistItem[];
  version: number;           // bump on edit; prestarts record the version answered
  updatedAt: Timestamp;
}

// ---- Vehicle ----
export interface Vehicle {
  orgId: string;             // denormalised
  siteId: string;
  fleetNo: string;           // human ID on the asset tag
  code: string;              // opaque deep-link code -> /v/{code}
  rego?: string;
  make?: string; model?: string; year?: number;
  type: string;              // selects template via cascade (type -> site -> org)
  status: 'available' | 'grounded' | 'retired';
  odometer: number;          // latest known
  serviceIntervalKm: number;
  lastServiceKm?: number;
  purchasePrice?: number;    // captured now for replace-vs-keep (§18)
  purchaseDate?: Timestamp;
  expiries?: { rego?: Timestamp; insurance?: Timestamp; inspection?: Timestamp };
}

// ---- Prestart (flexible answers map, §11) ----
export type Answer =
  | 'pass' | 'fail' | 'na'                                 // passfail
  | number                                                 // number
  | string                                                 // text
  | { value: 'fail'; note?: string; photo?: string };      // failed passfail + detail

export interface Prestart {
  orgId: string; siteId: string; vehicleId: string;
  templateVersion: number;
  answers: Record<string, Answer>;   // keyed by ChecklistItem.id
  odometer: number;
  operatorName: string;              // roster pick = attribution
  deviceId: string;                  // from token
  shift?: string; crew?: string;
  createdAt: Timestamp;              // SERVER-set, never client (tamper-evidence)
}

// ---- Defect lifecycle (§6) ----
export interface Defect {
  orgId: string; siteId: string; vehicleId: string;
  itemId: string; categoryId: string;
  grounded: boolean;                 // copied from category at creation
  note?: string; photo?: string;
  status: 'open' | 'in_progress' | 'pending_signoff' | 'closed' | 'carried_over';
  prestartId: string;                // origin
  workOrderId?: string; rectificationId?: string;
  createdAt: Timestamp; closedAt?: Timestamp;
}

export interface WorkOrder {
  orgId: string; siteId: string; vehicleId: string;
  defectIds: string[];
  code: string;                      // QR deep-link for the contractor sheet (§6)
  status: 'open' | 'closed';
  createdBy: string; createdAt: Timestamp;
}

export interface Part { name: string; cost: number; qty: number; }

export interface Rectification {
  orgId: string; siteId: string; vehicleId: string;
  defectIds: string[]; workOrderId?: string;
  description: string;
  parts: Part[];                     // feeds cost tracking + replace-vs-keep (§18)
  odometer: number;
  by: string;                        // staff name or contractor (via WO QR gate)
  createdAt: Timestamp;
}

export interface RosterEntry { orgId: string; siteId: string; name: string; pin?: string; active: boolean; }
export interface AppUser { orgId: string; email: string; role: Role; siteIds?: string[]; }
```

**Cascade resolver** lives in shared too (`cascade.ts`): given a vehicle + the org/site/type templates, return the most specific (`type → site → org default`). One pure function, unit-tested, used by the worker app and any server logic.

---

## 3. Firestore structure & read discipline

Mirrors §11 — operational records under the org, carrying `siteId` **and** `orgId` as fields:

```
orgs/{orgId}
  checklistTemplates/{templateId}
  roster/{rosterId}
  users/{uid}
  sites/{siteId}
    checklistTemplates/{templateId}        (optional override)
    vehicles/{vehicleId}
    prestarts/{prestartId}                 one per vehicle per day
    defects/{defectId}
    workOrders/{workOrderId}
    rectifications/{rectificationId}
    serviceRecords/{serviceId}
    kmHistory/{entryId}
```

**Why `orgId` is duplicated onto every operational doc:** the dashboard needs org-wide rollups (e.g. *all* open defects across every site). That's a **collection-group query** over `defects`, which spans the whole database — so it must be constrained by `where('orgId','==', myOrg)` and secured by a rule that checks `resource.data.orgId`. Without the field you can't write that query safely. Model these reads before building; you can't add a JOIN later (§9).

**Document IDs:**
- `prestarts`: `{vehicleId}_{YYYY-MM-DD}` — enforces one-per-vehicle-per-day and makes the carry-over/today lookups a direct `get`.
- `vehicles.code`: short opaque code, its own lookup map `vehicleCodes/{code} -> {orgId, siteId, vehicleId}` for `/v/{code}` deep links without exposing structure.

**Key composite indexes** (`firestore.indexes.json`):
- `defects` (collection group): `orgId ==`, `status ==`, order by `createdAt` — the mechanic worklist + glance.
- `defects`: `orgId ==`, `grounded ==`, `status ==` — vehicles-grounded count.
- `prestarts`: `vehicleId ==`, order by `createdAt desc` — per-vehicle history + audit export.
- `vehicles`: `orgId ==`, `status ==` — fleet availability.
- `vehicles`: `orgId ==`, `expiries.rego <=` (and per expiry) — upcoming-expiry alerts.

**Read discipline (cost, §9):** denormalise counts the glance needs (e.g. keep `openDefectCount` / `groundedCount` on the site doc, updated by a function) rather than fanning out live listeners across a 100-vehicle fleet. No loose real-time listeners on large collections.

---

## 4. Security rules architecture (`firestore.rules`)

Deny-by-default; every decision reads the **verified token**, never client input. Skeleton (not final — pair with the automated isolation tests):

```
rules_version = '2';
service cloud.firestore {
  function tok()        { return request.auth.token; }
  function signedIn()   { return request.auth != null; }
  function isPlatform() { return signedIn() && tok().platformAdmin == true; }
  function inOrg(orgId) { return signedIn() && (tok().orgId == orgId || isPlatform()); }
  function role()       { return tok().role; }
  function isAdmin(orgId){ return inOrg(orgId) && role() == 'admin'; }
  function serverTimed(){ return request.resource.data.createdAt == request.time; }

  match /databases/{db}/documents {

    match /orgs/{orgId} {
      allow read:  if inOrg(orgId);
      allow write: if isAdmin(orgId) || isPlatform();

      // customer self-service: admin manages fleet/people (§14)
      match /vehicles=**/ {}  // (illustrative; real paths below)
      match /sites/{siteId}/vehicles/{id} {
        allow read:           if inOrg(orgId);
        allow create, update: if isAdmin(orgId);
      }
      match /roster/{id} {
        allow read:           if inOrg(orgId);
        allow write:          if isAdmin(orgId);
      }

      // compliance evidence — tamper-evident: create-only, server time, no edits
      match /sites/{siteId}/prestarts/{id} {
        allow read:   if inOrg(orgId);
        allow create: if inOrg(orgId) && serverTimed();
        allow update, delete: if false;
      }
      match /sites/{siteId}/defects/{id} {
        allow read:   if inOrg(orgId);
        allow create: if inOrg(orgId) && serverTimed();
        allow update: if inOrg(orgId);          // status transitions; history appended, not erased
        allow delete: if false;
      }
      // workOrders / rectifications: same shape
    }

    // collection-group rollups for the dashboard — secured by the orgId field
    match /{path=**}/defects/{id} {
      allow read: if signedIn() && resource.data.orgId == tok().orgId;
    }
  }
}
```

Notes: the **platformAdmin exception** (`isPlatform()`) is the only cross-org door (§12.4), and most vendor work goes through Admin-SDK functions that bypass rules anyway — so this is mainly for the console *reading* customer data. Storage rules mirror the same org-match on the path `orgs/{orgId}/sites/{siteId}/...`. App Check is enforced on Firestore + Functions so only the real apps can call.

---

## 5. Auth architecture (§3, §12)

Three paths, one claims model.

**Workers — device token (no login).** Setup link/QR carries a `siteCode`. Client calls the `provisionDevice` callable:

```typescript
// functions/src/provisionDevice.ts
export const provisionDevice = onCall({ enforceAppCheck: true }, async (req) => {
  const site = await siteFromCode(req.data.siteCode);   // validates code, returns {orgId, siteId}
  const deviceId = crypto.randomUUID();
  const token = await getAuth().createCustomToken(`device_${deviceId}`, {
    orgId: site.orgId, siteIds: [site.siteId], role: 'worker', deviceId,
  });                                                    // claims ride inside the custom token
  await recordDevice(site.orgId, deviceId);              // for revocation list
  return { token };
});
```

Client: `signInWithCustomToken(auth, token)`, then persist so it survives offline. Revoke = remove the device record + a rule/function check against it. A multi-site worker just gets `siteIds: [a, b]` (§3) — the picker shows the union.

**Supervisors / admins — SSO + email-link.** Enable the **Microsoft (OIDC/Entra)** provider and **email-link** in Firebase Auth. Turn on "one account per email" so both resolve to the same user. On invite (or first SSO), a function sets their persistent claims:

```typescript
await getAuth().setCustomUserClaims(uid, { orgId, role: 'admin' }); // or supervisor + siteIds
```

Their token then carries the same `FleetpassClaims` shape — so rules don't care *how* they logged in, only what they are.

**Staff mechanics** = roster + a light account (email-link) scoped to mechanic role. **Contractor mechanics** = no account; enter via the work-order QR with a one-time token in the link.

---

## 6. Cloud Functions (`functions/`)

| Function | Trigger | Job |
|---|---|---|
| `provisionDevice` | callable | mint a worker device token (§5) |
| `revokeDevice` | callable (admin) | kill a device's access |
| `inviteUser` / `setClaims` | callable (admin) | create a supervisor/mechanic, set claims |
| `onDefectCreated` | Firestore trigger | Cat A/B → real-time alert to supervisor via Resend; ground vehicle if category says so |
| `onRectificationCreated` | Firestore trigger | close/transition defect; update vehicle status + service/cost rollups |
| `rollupCounts` | Firestore trigger | maintain `openDefectCount` / `groundedCount` on site doc (read discipline, §3) |
| `digest` | scheduled (pub/sub) | per-customer weekly/fortnightly/monthly email (§14) via Resend |
| `stripeWebhook` | HTTPS | sync subscription/entitlements → `orgs/{orgId}.billing` (§15) |
| `exportAudit` | callable | build the per-vehicle/date audit export (the artifact you sell, §22) |
| `killBilling` | pub/sub (budget alert) | hard daily spend cap — disable billing on threshold (§9) |

2nd-gen functions, region `australia-southeast1`, `enforceAppCheck` on callables, secrets (Stripe, Resend) in Secret Manager.

---

## 7. App architecture (`apps/`)

**Worker PWA** — the speed-critical surface.
- Routes: `/` (picker), `/v/:code` (a vehicle's prestart — the QR and the picker both land here), `/setup` (first-run provisioning).
- **Picker:** "your vehicles" recents/assigned at top (one tap for the usual unit) + group/fleet-no search (§3). Short list beats a scan.
- **Generic renderer:** `ItemType -> component` map (`PassFailControl`, `PhotoItem`, `NumberItem`, `TextItem`). Draws whatever the resolved template contains — new type = new case, never a migration (§8).
- **Submit:** write `Prestart` + create a `Defect` per failed item (grounded flag copied from its category); odometer sanity check (§13); works offline.
- **Sync indicator:** a hook bound to snapshot `metadata.hasPendingWrites` / `fromCache` (§5).

**Dashboard PWA** — role-routed (supervisor / admin / mechanic land on different home views off the same build, §14). Three layers: glance tiles (from denormalised counts), act-on lists (collection-group queries), per-vehicle drill-down. Admin self-service screens (fleet, roster, users, checklist editor). Installable to desktop/taskbar.

**Console** — vendor-only, `platformAdmin`-gated: onboarding, Stripe status, health/usage, support lookups via the audited lane.

**Shared app plumbing:** Firebase init (with emulator connect in dev), an `AuthContext` exposing claims, Firestore persistence enabled at startup, and `vite-plugin-pwa` for the app-shell service worker + manifest. State stays light — Firestore listeners via thin custom hooks (or `react-firebase-hooks`) + context for auth/org; no heavy global store.

> Two offline layers, don't conflate them: **Workbox** (vite-plugin-pwa) caches the app shell so it *loads* offline; **Firestore persistence** caches *data* and queues writes. You need both.

---

## 8. Environments & ops

- **Projects:** `fleetpass-dev` and `fleetpass-prod` (`.firebaserc` aliases), both Sydney region.
- **Emulator-first:** Firestore + Auth + Functions + Storage emulators for all local dev and the seed scripts — zero cost, zero risk to real data, and where slice 1 runs.
- **App Check:** reCAPTCHA Enterprise (web) enforced on Firestore + callables.
- **Budget cap:** Cloud Billing budget → Pub/Sub → `killBilling` (a real cap, not just an alert, §9).
- **Hosting targets** (`firebase.json`): `marketing`, `worker`, `dashboard`, `console`.
- **CI:** typecheck + the isolation tests (auth as Org A, assert Org B blocked) on every change; deploy rules/indexes/functions/hosting per target.

---

## 9. Build slices → concrete tasks

Build one thin vertical slice end-to-end first; everything after is additive.

### Slice 1 — Foundation + one real prestart *(prove the spine)*
1. `firebase init` (Firestore, Auth, Functions, Storage, Hosting, Emulators); set Sydney region; create `fleetpass-dev`.
2. pnpm workspace; `packages/shared` with `types.ts` (§2) + `cascade.ts` + unit test.
3. Minimal `firestore.rules` + `storage.rules` (org-match skeleton, §4); `firestore.indexes.json` stub.
4. `seed/` (Admin SDK → emulator): **digitise NSR229 and Gold Fields Rev 1** into `ChecklistTemplate` JSON; create two orgs, each a site + a few vehicles + its template. (Real seed data, real isolation test.)
5. `apps/worker`: Vite + React + TS + Tailwind; Firebase init w/ emulator; enable persistence; auth via a stubbed dev token (full provisioning is slice 2).
6. Build the picker → renderer → submit path; failed Cat A item creates a grounded defect; sync indicator hook.
7. Run end-to-end on the emulator; assert Org A cannot read Org B.

**Done = a real Northern Star prestart writes to Firestore, offline works, isolation holds.**

### Slice 2 — Worker identity & offline hardening
`provisionDevice` + `revokeDevice`; `/setup` flow from a site link/QR; device token cached for offline; odometer sanity check; conflict policy (last-write-wins via merge).

### Slice 3 — Defects & carry-over
Defect creation rules; carry-over surfacing unrectified faults at next prestart; status model; `rollupCounts` for the glance.

### Slice 4 — Supervisor dashboard (glance + worklist)
`apps/dashboard` shell + role routing; glance tiles from counts; open-defects collection-group worklist; per-vehicle drill-down.

### Slice 5 — Close the loop
Work orders (+ QR deep link), rectification entry (parts + cost), close authority toggle, mechanic role view, service records + km history.

### Slice 6 — Reporting + vendor side
`exportAudit` + PDF/report design (overbuild it, §22); `apps/console`; `stripeWebhook` + entitlements; `digest`.

### Slice 7 — Polish
Two skins (worker bright / dashboard calm), type scale + tap targets, offline-indicator polish, tenant co-branding, App Check + budget cap to prod.

---

## 10. Open technical decisions

- **Framework confirm** — React + Vite assumed; say if not.
- **Conflict resolution** — last-write-wins is the lean given one-prestart-per-vehicle-per-day; confirm before slice 2.
- **`react-firebase-hooks` vs hand-rolled hooks** — minor; decide at slice 4.
- **Stripe extension vs hand-written webhook** — extension is faster, a webhook is more control; decide at slice 6.
- **Console as separate app vs guarded dashboard route** — separate assumed (blast radius); revisit if it's overhead.
- Indexes and the full ruleset get finalised as the queries they serve get built (§19 of the plan).
