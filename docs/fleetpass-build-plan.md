# Fleetpass — Product & Build Plan

*Working planning document. Living — sections marked "Open" are still being decided.*
*Last updated: 20 June 2026*

*Latest revision: scoped the product **light-vehicle-first** (heavy vehicles become a later checklist template, not a rebuild) and reframed LV compliance around the **WHS duty of care** rather than the HVNL / Chain of Responsibility; confirmed the **Firebase** stack over Supabase (offline is the decider) and that the supervisor dashboard ships as an **installable PWA, not a native .exe**; locked the **brand direction** (three-chevron / chevron-check mark, Archivo · Hanken Grotesk · IBM Plex Mono, the pass cascade) and built a first **deployable marketing landing page** to gauge demand. Added §21 competitive landscape & honest positioning grid, §22 design language, and §23 marketing site & positioning copy. Most recent: merged in the supervisor **email-link (passwordless) login fallback** alongside Microsoft SSO (§3, §12), and recorded the two **real-world reference forms** — Northern Star (NSR229) and Gold Fields (Rev 1) — in §8.*

---

## 1. What Fleetpass is

Fleetpass is an offline-capable, multi-tenant SaaS platform for daily vehicle prestart compliance and defect management, built for **Australian light-vehicle (LV) fleets** — the utes, vans, 4WDs, pool cars and site light vehicles run by councils, civil contractors, agriculture, trades, utilities and the resources sector. Heavy vehicles are deliberately out of scope at launch and become a later checklist template (not a rebuild) if a client needs them; the checklist engine is vehicle-type-agnostic from day one, so a mixed fleet with the odd truck is handled without a fork.

Its core job is to close the broken handover chain between the three people involved in a vehicle defect: the worker who spots it during a prestart, the supervisor who logs and actions it, and the mechanic who fixes it. Today that chain runs on verbal handovers and paper, and data falls out of it at every step. Fleetpass makes the defect carry its own history end to end — both the operational win and the audit trail.

**Why LV, and why it changes the compliance frame.** Heavy vehicles have a clear legal hammer — the Heavy Vehicle National Law and Chain of Responsibility, audited by the NHVR — which is exactly why the heavy end of the market is already well served (Hubfleet, the telematics suites). Light vehicles fall *outside* the HVNL. LV prestart compliance is driven instead by the **WHS Act general duty** (the business must provide and maintain safe vehicles/plant), the **site's own access rules** (resources sites mandate LV prestarts regardless of any vehicle law), and plain **duty-of-care / insurance defensibility**. So the product and the marketing lead with *duty of care* and *satisfying the site's prestart requirement* — not HVNL. The wedge in one line: **fleet software is all built for trucks; Fleetpass is built for the utes.**

Differentiation wedge (honest — see §21): Australian WHS framing, obsessive worker-speed, per-tenant data isolation, mid-market pricing, and audit-export quality. The closed-loop defect lifecycle is **table stakes done well, not a unique differentiator** — Whip Around and Hubfleet already ship versions of it; it's a reason to switch *from paper*, not from a mature competitor. Fleetpass is behind incumbents on maintenance depth and product maturity and does not try to win there. It wins by being unmistakably the best tool for **one buyer — the Australian sub-50-vehicle LV fleet** — not by matching feature breadth.

---

## 2. Core principles

- **Worker-speed is sacred.** Any friction in the worker prestart flow is a product failure. A worker at 5am completes a prestart in under a minute, no login screen. (LV prestarts are short, which makes the sub-2-minute promise genuinely deliverable — an HV prestart would blow past it.)
- **Protect the defect chain.** The integrity of a defect's data as it moves worker → supervisor → mechanic is the reason the product exists. Nothing is allowed to drop that data.
- **Light-vehicle-first, not light-vehicle-only.** Built for the ute fleet everyone else ignores; the checklist engine still handles the odd truck so a mixed fleet isn't turned away. Heavy-vehicle depth is a later, client-driven config — never the headline.
- **Opinionated defaults, deliberate toggles.** A strong point of view ships by default. Configuration exists only where customer policy or risk genuinely differs, and every toggle must earn its support cost.
- **Self-service for the customer.** Customers run their own fleet and people. The vendor is never in the loop for routine admin — that's how it scales.
- **Industry-credible, not industry-locked.** Reads professional across fleet sectors; deliberately avoids hi-vis orange.
- **Build it right from day one.** Structural decisions (deep-link URLs, org/site hierarchy, type-driven checklists, a type-agnostic checklist engine) are built correctly up front, so nothing has to be unpicked later.

---

## 3. Roles & identity

Four roles, three identity tiers. Identity fits how each role works, not uniformity.

| Role | Does what | Identity | Connectivity |
|---|---|---|---|
| Worker | Daily prestart checks, flags defects | Roster — taps their name (optional PIN), remembered on their own phone | Offline-capable |
| Mechanic | Servicing, rectifies / closes defects | Staff: on a mechanic roster. Contractor: no account — QR on the printed work order | Online (workshop) |
| Supervisor | Monitors fleet, triages defects, raises work orders | Microsoft SSO (Entra) | Online (desk) |
| Owner / Admin | Runs vehicles, roster, users, settings, billing | Microsoft SSO (Entra) | Online (desk) |

**Customer-side admin split:** the owner/admin runs the account (fleet, people, users, settings); regular supervisors monitor and triage but don't restructure the account. The customer self-administers; the vendor is not in that loop (see §14).

**Supervisor/admin login:** Microsoft SSO (Entra) by default — most customers are on M365 — with an email-link (passwordless) fallback for those who aren't, both resolving to one account by verified email. (Full posture in §12.)

**Why no SSO for workers:** OAuth needs connectivity to handshake and refresh tokens — incompatible with the offline worker surface, and many contractors/casuals aren't on the org's tenant anyway.

**How workers are scoped without logging in:** the *device* authenticates, not the person. At setup (once, online) the device opens a site link/QR carrying a site code; a provisioning function validates it and mints a Firebase token with `orgId`, `siteId`, `role: worker` baked in — a custom token (or anonymous sign-in + custom claims), minted per device so a single device can be revoked. The token is cached and works offline; rules read its `orgId`/`siteId` to scope access regardless of which human is using it. Site access is a list (usually one) — an admin can grant a worker a second site with a single toggle and the picker shows the union, built as an array from day one so adding a site is never a rebuild. The worker's name is a roster pick on each prestart — token gives scoping, name gives attribution. Protect the setup link/code (posture: physical site access ≈ prestart access); a wiped device simply re-provisions.

**Device model:** default is the worker's own phone, remember-me. Per-client option: shared-device mode (mounted/muster tablet), pick-name-plus-PIN each time.

**Entry points (refined):** regular workers use a **scoped vehicle picker** in the installed PWA — fast because it's *short*, not because it's clever. Two layers keep the list short on a 100+ vehicle site: (1) a "your vehicles" recents/assigned list at the top (most operators drive the same one or two units → one tap), and (2) vehicle groups + search by fleet number for everything else. They do **not** scan a QR daily. **QR is the fallback, not the primary UX** — it's for first-time device setup and for no-account contractors / one-offs, and it deliberately bypasses scoping (anyone should be able to prestart any vehicle they end up in). On a cracked screen in the dark with gloves, two taps on a short list beats a camera scan.

---

## 4. Tenancy model

- **Org = hard boundary.** The customer who pays. Two orgs can never see each other's data. Billing and isolation sit here.
- **Site = soft boundary.** A physical operation inside an org. Workers scoped to their site(s); org-level roles see across all.

One deployment, logical multi-tenancy. Adding a site is a data operation — create a site record, load roster, add vehicles, print tags. Provisioning, not redeploying.

Rollout: customers start with one tester site (an org with a single site, on the full org→site structure from day one, so a second site is a record not a migration).

*Escape hatch:* a future enterprise demanding physically separate data is promoted to a dedicated Firebase project. Designed for, not built now.

---

## 5. Connectivity model

Online-first, offline as graceful fallback. Most prestarts happen in the carpark/muster area, usually on the site's WiFi; offline is the safety net (vehicle with no signal, dropout mid-submit), not the headline.

Firestore's built-in offline persistence handles it for free: writes queue locally and sync on reconnect, no hand-rolled queue. A sync indicator shows pending / synced / offline, bound directly to Firestore's `hasPendingWrites` / `fromCache` flags.

*Open:* conflict-resolution policy (last-write-wins likely, given one-prestart-per-vehicle-per-day).

---

## 6. The defect lifecycle (the spine)

A defect carries its own history through four stages:

1. **Prestart check** (Worker) — a failed item creates a flagged defect tied to vehicle, check, date, and who flagged it.
2. **Work order** (Supervisor) — triage; raise a *pre-service* work order. The printed work order carries a QR so the (often no-account) mechanic can scan the sheet they're handed and pull up the open defects — the physical handover still happens, but the QR pulls the result back into the system.
3. **Service + fix** (Mechanic, staff or contractor) — log a *post-service* rectification record: what was done, by whom, odometer, date. Contractors enter via the work-order QR; a light gate (workshop PIN or one-time token in the link) attaches a name to the close so the audit trail holds.
4. **Closed or carried over** — closed (see close authority, §7), or carries over and re-surfaces at the next prestart until rectified.

Carry-over is core: it stops a known fault quietly disappearing off a paper form. Maps to the four backend domains — prestart compliance, defect lifecycle, servicing, reporting.

---

## 7. Configuration philosophy

**The rule:** opinionated defaults everywhere; toggles only where policy or risk genuinely differs and the difference is worth its support cost.

**Fixed (never client-configurable):** the worker flow mechanics, the data model, and the shape of the closed loop. A client doesn't reconfigure how a defect moves through the chain — that's the product.

**Configurable (policy at the edges):**

| Behaviour | Default | Notes |
|---|---|---|
| Vehicle tagged out on a fail | Off — flag loudly, trust humans | Set per severity category (§8): a category can carry "grounds the vehicle"; the org chooses which categories tag a vehicle out |
| Defect close authority | Supervisor or mechanic can close | Stricter option: mechanic rectifies → "pending supervisor sign-off"; recommended for contractor mechanics |
| Worker PIN | Off — tap name only | On for firmer attribution |
| Shared-device mode | Off — personal-phone remember-me | For sites banning personal phones in ops areas |
| Photo required on an item | Off | Per item/template; e.g. mandatory photo on a Cat A item |
| Service interval | 5,000 km | Per vehicle |

Location/GPS is **not** used at all (privacy + permission friction). Network-of-sync can be an optional soft on-site flag for strict sites (§13).

**Sales framing:** lead with the strong default; offer config as bounded tuning ("set to your site's WHS rules"), not "fully customisable" — the latter invites bespoke scope. (Note: the *marketing* still advertises customisation — "your site, your needs, your prestarts" — see §23. The two aren't in tension: the customer gets their own forms, branding and categories; what they don't get is the ability to re-architect the closed loop.)

---

## 8. Checklists

First-class, fully data-driven content — every customer brings their own.

**Cascade (resolution):** a checklist template lives at the **org** level by default and applies to every vehicle; optional **site** or **vehicle-type** overrides sit beneath it. A vehicle uses the most specific template that applies (type → site → org default). Most customers only ever populate the org default (e.g. one company-wide LV book).

**Type-driven, extensible items (build-it-right-now):** each item carries a `type` — `passfail`, `photo`, `number`, `text` — with flags (`required`, `photoRequired`, `category`). Today every item is pass/fail/na, but type-driven from the start means a different site wanting photos or a tyre-pressure reading is just items of a different type. The worker screen is a **generic renderer** — it draws whatever types the template contains. New item type = a renderer case, never a schema migration or per-site code fork. *This is also what makes the eventual heavy-vehicle template a config rather than a rebuild (§18).*

**Photos → Firebase Storage**, not the database: stored at org/site-scoped paths with their own rules; the submission holds a pointer. Photo-heavy sites store photos; others have none. Additive and tenant-isolated; nothing in the data model breaks when sites differ.

**Onboarding a customer's book (concierge):** the customer hands over their existing book in any format — spreadsheet, PDF, photo of a laminated card. Vendor-run, not self-serve, to keep quality high:
- Clean/structured input → direct import.
- Messy/unstructured input → AI parses it into the template structure.
Whatever the input, it lands in one canonical structure (categories + items). A human review before go-live is non-negotiable — a mis-read or dropped item is a WHS gap.

**No existing book (paid build):** a customer without a prestart book gives their fleet size plus makes and models, and Fleetpass produces a compliant prestart set for them as a paid onboarding service — built from manufacturer daily-check guidance and standard light-vehicle items. Still bespoke per customer, just paid when there's no source material to digitise (not a generic template library).

**Editing afterwards:** changing a prestart means editing template data (add/remove/reorder/reword items, set categories), not code; edits apply to the next prestart for that org/site. The customer's admin can do this themselves once it's set up — the digitisation is the only white-glove step.

**Severity categories (per-org):** each org defines its own categories rather than a fixed A/B/C. A category carries properties, not just a label and colour — whether a fail in it **grounds the vehicle** (tags it out) and whether clearing it needs a sign-off. Ships with an editable A/B/C-style default so nobody starts blank. Trade-off accepted: severity isn't comparable across customers, which barely matters since each only cares about its own fleet.

**Reference forms (real-world):** two existing customer books — Northern Star (NSR229) and Gold Fields (Rev 1) — confirm the model. Both run A/B/C-by-consequence (A grounds; B grounds until a maintenance sign-off; C report-only), put the *same* checks in *different* categories, and Northern Star even adds a fourth "Functional and Operational Checks" group outside the A/B/C hierarchy — all only representable because the category set and item-to-category mapping are the customer's own data. Both are good candidate seed templates for slice 1 (load as two test orgs to exercise isolation + the cascade on real data). One small model nicety they prompt: an optional sub-heading within a category, like Northern Star's "FIRE HAZARDS" grouping.

---

## 9. Tech stack

- **Cloud Firestore** — data + offline persistence (replaces the old Supabase/Postgres layer).
- **Firebase Storage** — photos and files, org/site-scoped paths and rules.
- **Firebase Auth** — Microsoft SSO (Entra) for supervisors/admins; per-device scoped tokens for workers (no OAuth on the offline surface).
- **Cloud Functions (Admin SDK)** — provisioning, vendor/admin operations, anything that must run server-side.
- **Firebase Hosting** — serves both PWAs.
- **Stripe** — billing (Firebase has a Stripe extension).
- **Resend** — transactional + scheduled report email.
- **PWA** — installable, offline-capable worker app + supervisor web app.

***Stack decision — Firebase over Supabase (confirmed).*** The deciding factor is **offline**. The worker does prestarts where there's no signal, and the product promise dies if a check doesn't save and sync reliably. Firestore's offline persistence is free and battle-tested; Supabase has no first-class offline and would mean hand-rolling an IndexedDB sync queue with conflict handling (the brittle thing the PrestartMate prototype did) or bolting on a third-party layer like PowerSync. The device-scoped worker token model also fits Firebase Auth custom tokens/claims naturally. The one genuine cost is **SQL-grade reporting** — addressed by piping Firestore → BigQuery for heavy analytics, while the headline audit export ("12 months for one vehicle") is a bounded per-vehicle/date query Firestore handles natively with an index. The only long-term caveat is lock-in (Firestore is proprietary; Postgres is portable) — a "maybe someday" cost, not a now-problem.

***Delivery — installable web app, not a native build (decided).*** Both surfaces are PWAs served from Firebase Hosting; the **supervisor dashboard installs to the desktop/taskbar** for an app-like feel without being an executable. A native `.exe` was considered and rejected: the dashboard is a desk-based view of *server* data that needs connectivity regardless of packaging, so native buys nothing technical; meanwhile an executable adds IT-install friction (locked-down standard operating environments on mine sites and councils), update fragmentation, cross-platform/code-signing overhead, and — counter-intuitively — a *harder* security sell than a web app on HTTPS + Entra SSO + per-tenant rules. The PrestartMate trial prototype stays on Vercel; the real product is Firebase end to end.

*Honest tradeoff:* audit/reporting exports are cleaner from SQL than Firestore. Addressed with export tooling; if it ever constrains, pipe Firestore → BigQuery for reporting.

*Cost posture:* Firebase is materially cheaper than a flat-fee backend at this stage — the free Spark tier (50k Firestore reads / 20k writes per day, 2M function calls/month) covers the first chunk of customers, and the workload is light-write (one prestart per vehicle per day). Two caveats to build in: (1) Blaze is pay-as-you-go with **no native hard spend cap**, and Firestore bills *per read* — a runaway dashboard listener or a bug can turn a $20 month into a $2k one. Set a **hard daily budget cap from day one** (Cloud Billing budget + a kill-billing function), not just an alert, and keep reads disciplined (denormalise, cache, no loose real-time listeners across large fleets). (2) Host in the Sydney region (`australia-southeast1`) for onshore data residency; AU-region rates run slightly above the headline US numbers, so budget with those. (3) NoSQL punishes you for not designing around your query patterns up front — model the dashboard and export reads *before* building, since you can't bolt on a JOIN later.

---

## 10. Domains & URL architecture

- **Single app domain** — e.g. `app.fleetpass.com.au`. Tenant resolved from the session, not the URL.
- **Per-vehicle deep links** from day one. QR is a printed shortcut to a route — and the scoped picker navigates to the *same* per-vehicle route, so the QR is literally a printed shortcut to a destination that already exists.
- **Opaque vehicle codes** — `fleetpass.app/v/AB12CD` → `{org, site, vehicle}`. Short = denser scan; opaque = no org structure on the sticker.
- **Work-order deep links** — same pattern, for the contractor rectification flow.
- **Custom subdomains/domains** — a "feels like ours" premium for later.

---

## 11. Data model (Firestore)

- `orgs/{orgId}` — customer, billing, org-level config
  - `checklistTemplates/{templateId}` — org default book (type-driven items + categories). Applies to every vehicle unless overridden.
  - `sites/{siteId}` — physical operation, site-level config, roster
    - `checklistTemplates/{templateId}` *(optional)* — site- or vehicle-type-level override
    - `vehicles/{vehicleId}` — record, **type/class**, service info, status, purchase price + date (captured now to feed later replace-vs-keep analysis, §18)
    - `prestarts/{prestartId}` — one per vehicle per day; answers stored as a **flexible map** (`{item: 'pass', item2: {value:'fail', note, photo}, item3: 42}`), odometer, who, when, shift, crew
    - `defects/{defectId}` — flagged defect; status, history, links to prestart / work order / rectification
    - `workOrders/{workOrderId}` — pre-service record
    - `rectifications/{rectificationId}` — post-service record (incl. parts used + cost)
    - `serviceRecords/{serviceId}` — mechanic service log
    - `kmHistory/{entryId}` — odometer history
  - `roster` — workers and staff mechanics
  - `users` — supervisor/admin accounts and roles

**Structure (decided):** operational records live under the org and carry a `siteId` field; the org is the hard wall (one rule: token `orgId` must match), `siteId` is the soft filter. Isolation enforced in security rules, never the client. Submissions are flexible maps so different sites' answer shapes coexist in one collection. Photos referenced from Storage. (Indexes and detailed rules still to finalise.)

---

## 12. Security

**1. Tenant isolation — the thing that matters most.**
- Deny-by-default rules; rules and server functions decide access from the *verified token's claims*, never a client-supplied org ID.
- Automated isolation tests in the build (authenticate as Org A, try to read Org B, assert blocked) on every change.
- Firebase App Check — requests must come from the real app, not a script hitting endpoints directly.

**2. Auth, with no passwords to lose.**
- Supervisors/admins via Microsoft SSO (Entra) by default: IdP handles login + MFA; Fleetpass stores no passwords. **Email-link (passwordless) fallback** for customers not on Microsoft, or whose IT can't easily consent to a third-party SSO app — a one-time sign-in link, so the no-passwords stance holds. Both methods link to the same account by verified email, so one person using either path keeps one identity, role and org.
- Worker devices: per-device scoped token, revocable, limited to its org/site. Provisioning code unguessable/revocable.
- The Firebase config (`apiKey`) is **public by design** — not a secret; security is rules + App Check. Real secrets (Stripe, Resend, service accounts) server-side in Secret Manager.

**3. Protecting the data.**
- Encrypted in transit (HTTPS) and at rest (Firestore default).
- Tamper-evident records: prestarts/defects/rectifications are compliance evidence — server-set timestamps, no silent edit/delete of submitted records.
- Least privilege by role.
- Data residency: Firestore + Storage in an Australian region so data stays onshore.

**4. Vendor super-admin lane (without breaking isolation).** Fleetpass staff carry a `platformAdmin` claim; rules add one exception — match the org *or* be a platform admin. Tenant-to-tenant isolation is untouched. Most vendor actions run through Admin SDK functions (bypass rules anyway; the function checks platform-admin first); the rules exception is mainly for the console *reading* customer data. That power is tightly held: few people, MFA, and every cross-customer access logged.

**5. Lifecycle, blast radius & ops.**
- Revoke a device, offboard a supervisor via the customer's Entra, expire a contractor link. Deleting a departing customer = one clean operation (the org hard wall).
- Worker no-login model is bounded: a compromised device can only submit prestarts/defects for its own site — can't read the dashboard or reach another org.
- Keep dependencies current (bundle or SRI on CDN scripts); a **hard daily Firebase budget cap** (not just alerts) plus monitoring, so abuse or a read-amplification bug shows up as a *capped* spike rather than a surprise bill. Blaze has no native hard cap — enforce it with a Cloud Billing budget wired to a kill-billing Cloud Function.

**Security cert:** not pursued now. But the isolation, audit logging, encryption and onshore-data choices above already line up with what SOC 2 / ISO 27001 look for — so if a customer ever demands one it's a documentation-and-process exercise, not a re-architecture. Pursued reactively when a deal needs it.

---

## 13. Prestart integrity / anti-fraud

Goal: make honest use frictionless and dishonest use harder *and* visible — deterrence and detection, not a lie detector. Bar to clear is paper, which is trivially faked.

- **Wrong car / site-to-site** — handled by construction: device locked to its site + the scoped picker (can't reach another site's vehicles) + QR opens *that* vehicle. Fabrication within the right site is caught by the **odometer sanity check** (≥ yesterday, within a sane daily jump).
- **Not on site** — no GPS (too invasive, needs a permission). Optional soft signal: log the **network the sync came from** server-side (no permission) and flag a strict site's submissions that don't come over its network. Honest limits: coarse, and offline-first means it reflects where it *synced*, not where the inspection was.
- **Nefarious / pencil-whipping** — can't be prevented; handled by accountability (every prestart carries who, device, when) plus dashboard **anomaly flags** (implausibly fast, all-pass every day, off-network), plus optional photo (occasional spot-check or mandatory on a Cat A item — hard to fake remotely).

All stricter checks are per-site toggles; the default stays fast. QR is the setup/contractor anchor, not a daily presence check — daily integrity rests on device-scoping + odometer + accountability, the deliberate trade for worker-speed.

---

## 14. Supervisor dashboard

**Delivery:** the dashboard is an **installable PWA** (desktop/taskbar icon, standalone window), not a native app — see the rationale in §9.

Organised so what matters is glanceable and the technical detail is a click away — three layers.

**Layer 1 — the glance.** Vehicles available vs grounded; today's prestart compliance (who did/missed — quietly the heart of the product); open critical (Cat A/B) faults; coming up (services due soon, rego/insurance/inspection expiries).

**Layer 2 — the lists you act on.** Open defects sorted by severity and age (the mechanic's worklist); services due by km and by forecast (usage-rate based); usage/utilisation (km over time, who's working hard vs idle); service & parts log.

**Layer 3 — the drill-down.** Per vehicle: prestart history, every defect and rectification, full service/parts history, usage graph, attached docs (rego, receipts, damage photos), running cost.

**Mechanic's view:** role-tuned landing, not a separate app — a mechanic opens straight to his worklist; tap a fault, log what he did + parts used, mark rectified. That entry feeds the service log and cost tracking. Analytics stay out of his way. (Contractor mechanics with no account enter via the work-order QR — §6.)

**Reports & notifications:** split by urgency — real-time for what can't wait (Cat A flagged → supervisor; overdue rectification → escalate), periodic digest for the rest. Digest cadence is per-customer (weekly / fortnightly / monthly), emailed via Resend, covering compliance %, faults opened/closed, services due/done, parts and cost.

**Self-service fleet & people (customer-run):** the customer admin manages their own vehicles (add/edit/retire; ID, make/model, type, intervals, status), worker roster (starters in, leavers out), and users (invite/remove supervisors and mechanics; issue/revoke worker devices). The vendor is not in this loop. All scoped to their org and gated to the admin role by their token.

**What else it covers:** compliance/expiry tracking (rego, CTP/insurance, inspections — date-based alerts); cost per vehicle and per km (from parts + service); utilisation for right-sizing; on-demand audit export (prestarts/defects/rectifications); document & photo storage per vehicle.

---

## 15. Vendor admin console

The operator back-office, separate from anything a customer sees.

- **Onboarding:** create an org, add sites, generate device provisioning links, print QR/asset tags, run the concierge checklist digitisation. A few-minutes form, not a deploy.
- **Subscriptions (Stripe):** plan, trial vs paid, billing status, upgrade/downgrade, the unhappy path (failed payment → grace → suspend), clean offboarding (export then delete the org subtree).
- **Plans & entitlements:** banded by fleet size — Intro (≤5, exploration), then ≤10, ≤20, ≤30, and "talk to us" above. Discrete plans, not per-vehicle metering (easier to sell; a band change is a one-click prorated swap). Monthly and annual. Feature flags tied to plan.
- **Pricing anchor & position:** set band prices to land around the equivalent of **~$6–9 AUD/vehicle/month** — undercutting Hubfleet (~$15, the closest local rival) while sitting competitively with Fleetio and Whip Around once their USD rates convert. Lead with the recurring plan; offer **done-for-you onboarding as an optional paid package**, *not* a mandatory sign-up fee (a setup fee adds friction at the first "yes", and there's little self-serve onboarding to charge for). Use **annual billing** (≈2 months discounted) as the commitment / cash-flow lever instead. Waive onboarding for the first few reference customers in exchange for case studies. *(Public marketing tiers on the landing page: Starter $99/≤15, Professional $299/≤50, Enterprise = talk; per-vehicle framing, 30-day free trial. See §23.)*
- **Commercial reality:** unit economics are strong (SaaS gross margin ~90%+ on Firebase; break-even ~6 customers while bootstrapped, ~50 to fund a full founder salary). The binding constraint is **distribution against Hubfleet, not unit economics** — go-to-market effort matters more than feature breadth. Full setup/cost detail in §20.
- **Billing runs entirely on Stripe — no custom invoice generator.** Small/exploration customers self-serve by card (Stripe auto-invoices, retries, hosted customer portal = zero admin). Bigger mine sites pay by PO / bank transfer on NET terms via Stripe Invoicing (BECS/EFT; Stripe tracks and chases). Band edges are a **soft cap** — warn and prompt an upgrade, never block adding a vehicle (a billing limit must not stop a safety check). A Stripe→Firestore sync (extension or webhook functions) holds each org's plan + entitlements.
- **Health & usage per customer:** active devices, prestarts/day, last activity — churn early-warning and support lens.
- **Support access:** look into a customer's data to troubleshoot — via the audited `platformAdmin` super-admin lane (§12.4).

---

## 16. Branding

- **Name:** Fleetpass. Lean the name into the product language — a completed prestart is "today's pass"; the rolling record is the vehicle's "passbook"; the export is the "passbook report."
- **Palette:** deep ink-teal anchor (`#0E4A40`) — trust, compliance, calm, what the desk buyer pays for — + green "pass/go" accent (`#1D9E75`). Paper/near-black neutrals around it. **Not hi-vis orange** (orange silently fences the brand into mining; a mining client can put *their* orange on the reports via tenant branding). *(Swaps the legacy `#BA7517` from the prototype.)*
- **Logo — the chevron family (locked direction).** A three-chevron "fleet" formation whose leading chevron doubles as a checkmark ("pass"). Used as a **responsive mark** at three densities: single chevron-check (favicon / app icon), chevron-check + motion trail (primary), three-chevron trio (marketing / expressive). Trailing chevrons in greys (`#BFBFBF` / `#808080`), the lead in green `#1D9E75`.
- **Type stack:** **Archivo** (display/headlines — sturdy, utilitarian, fleet-grade), **Hanken Grotesk** (body), **IBM Plex Mono** (data only — fleet numbers, timestamps, asset-tag meta).
- **On-vehicle asset tag:** mark + fleet number + QR as a single printed object (branding doing a job, not decoration).
- **Motion:** the chevron cascade — left-to-right opacity cascade for loading; a settle-with-green-pop for submit / "pass" confirmation. Reused on the marketing site's early-access form. Respects `prefers-reduced-motion`.
- **Anti-pattern noted:** monospace, all-caps, wide-tracked accent labels floating above headings read as AI/vibe-coded boilerplate. **Mono is reserved for genuine data;** section labels are sentence-case in the display face with a small chevron-tick marker.

---

## 17. Onboarding / deployment flow

**Vendor does (once per customer):** create the org (Stripe), add the first site, digitise their prestart book (concierge), set plan/toggles. Then hands over.

**Customer runs (ongoing, self-service):** add vehicles, load/maintain the roster, invite supervisors and mechanics, issue/revoke worker devices, print QR/asset tags, edit their own checklist.

**Workers:** open the URL / installed app — no setup per worker.

This split is the point: the vendor's per-customer load is onboarding + billing + support, nothing daily.

---

## 18. Future / phase-two

- **Heavy-vehicle templates** — HV prestarts are a longer checklist with truck-specific items (coupling, load restraint, air brakes) plus the HVNL / Chain-of-Responsibility framing. Because the checklist engine is type-agnostic (§8), HV is a config a client unlocks, not a rebuild. Client-driven, not a launch goal — and a deliberate move *up* into a more crowded, better-served fight, so only on real demand.
- **Fleet lifecycle / replace-vs-keep analytics** — turn the parts + service cost already being captured into a cost-to-keep view per vehicle, trended against age and km, flagging when a vehicle's trailing maintenance crosses the point where replacing beats keeping (the classic economic-life call). Mostly an analytics layer on existing data; the one extra input is the vehicle's acquisition cost + a residual estimate (captured on the vehicle record now, §11). A genuine management value-add beyond compliance — most inspection apps don't touch it.
- **Telematics integration** (e.g. Tracertrak) — integrate, never replace. Ingest from whatever tracker the client already runs; the real prize is automatic odometer (one less tap, more honest service/usage data). Client-driven and case-by-case, because every telematics API differs.
- Fuel tracking, live GPS / driver-behaviour — the obvious next asks, but they pull toward being a telematics suite (a different, crowded fight). Not the wedge.

---

## 19. Open items / next steps

**Decided this round:** light-vehicle-first scope (HV is a later template; LV framed around the WHS duty of care, not HVNL); **Firebase confirmed over Supabase** (offline is the decider); supervisor **dashboard ships as an installable PWA, not a native .exe**; **brand direction locked** (three-chevron / chevron-check responsive mark, Archivo · Hanken Grotesk · IBM Plex Mono, the pass cascade, ink-teal `#0E4A40` + green `#1D9E75`); first **deployable marketing landing page** built (LV-framed, early-access capture, "your site/your needs/your prestarts" customisation section); supervisor login **Microsoft SSO + email-link fallback**.

**Decided earlier:** billing (banded Stripe plans, no invoice generator), worker multi-site (array, one by default), severity categories (per-org, grounding as a category property), checklist sourcing (concierge every time + paid build when there's no book), security cert (reactive — foundation already aligns).

What's genuinely left is build-time detail and design work, not product decisions:

- **Website:** swap the early-access form from the Supabase placeholder to **Firestore** (`early_access` collection, insert-only rule), drop in the final logo, deploy to Firebase Hosting; then a polish pass on residual tracked-caps mono labels, plus FAQ / OG meta + favicon / analytics. (See §23.)
- **Design language:** lock the foundations — status colours (Pass/Fail/N/A + Cat A/B/C, colour-blind-safe), type scale + tap-target sizing, and the signature Pass/Fail/N/A control. These unblock the worker app. (See §22.)
- **Offline:** conflict-resolution policy (likely last-write-wins).
- **Data:** finalise Firestore indexes and the detailed security rules.
- **Reporting:** PDF/report design and audit-export format (the artifact you're actually selling).

Natural next builds: the design-language foundations + the worker app's prestart screen; or the PDF/report design.

Pre-launch commercial & legal setup (entity, GST, legals, trademark, insurance) is tracked in §20 — a parallel workstream to the build.

---

## 20. Commercial & legal setup (pre-launch)

The product/architecture above is the build; this is the wrapper needed to actually trade. Recommendations, not all executed yet.

**Entity & registration**
- **Pty Ltd company.** Limited liability matters for a product sitting in a safety-compliance chain — a missed defect must never reach the founder's personal assets. Also reads as credible to enterprise buyers and is investment-ready. ASIC registration ~$611 (rising to $636 from 1 July 2026 — register before then). ABN is free via the ABR; the company also gets an ACN and its own TFN.
- **GST:** register from day one (customers are GST-registered businesses who claim it back; lets you claim credits on your own costs). Charge 10%, lodge BAS quarterly.
- **Company tax:** 25% (base rate entity). Profit can be **retained in the company at 25%** and drawn later as wages or **franked dividends** — usually more tax-efficient than a salary while the founder is on a high marginal rate from the day job. Avoid informal drawings (Division 7A risk).

**Domains:** `fleetpass.com.au` (requires an active ABN/ACN), plus `.com` and `.au` to protect the brand.

**Legal docs — non-negotiable before launch:**
- **Terms of Service / subscription agreement** that make explicit the **customer retains responsibility for their own WHS compliance** — Fleetpass is a tool, not their safety system of record. Plus limitation of liability, IP ownership, payment terms, termination.
- **Privacy Policy** aligned to the 13 Australian Privacy Principles. The small-business turnover exemption is being removed (Tranche 2 reforms, ~2026–27), and the statutory tort for serious invasions of privacy is **already live (June 2025)** — so build to APP standard regardless. Cross-border disclosure (APP 8) is moot here because data is onshore (Sydney region) — itself a selling point against offshore rivals.
- Stripe won't go fully live without Terms + Privacy URLs anyway.

**IP caveat (carry-over from the original brief — resolve before taking money):** the PrestartMate prototype was built using work time / work context, so under standard Australian employment IP-assignment clauses the employer may have a claim. Get an employment lawyer to review the contract; lowest-risk path is asking the employer directly or rebuilding cleanly on own time. The Firebase rebuild helps (clean-room, own time), but the checklist content/IP question still needs clearing.

**Trademark:** register **"Fleetpass"** with IP Australia in classes **9 (software)** and **42 (SaaS)**. A company/business name does *not* confer trademark rights. ~$250–330/class DIY, ~$1,200–3,000 with an attorney.

**Insurance:** **professional indemnity** (resources/mining customers will likely require evidence before signing) and **cyber** (customer data is held). Public liability optional for pure SaaS.

**Indicative cost to launch:** lean DIY ~$1,000 one-off + ~$330/yr to stay registered; done properly (lawyer-drafted legals, trademark, PI/cyber) ~$3,000–8,000, most of it legals plus first-year insurance. Recouped within ~2 months of trading at modest scale.

*Security cert (SOC 2 / ISO 27001):* still reactive per §12 — the foundation already aligns; pursue only when a deal demands it.

---

## 21. Competitive landscape & positioning

**Honest headline:** this is a crowded space, and "digital prestart" on its own is table stakes. The LV-first scope is partly a *competitive* move — it sidesteps the heavy-vehicle-focused incumbents entirely.

**The tiers:**
- **Generic inspection platforms** — *SafetyCulture* (formerly iAuditor; Australian, the giant, vehicle prestart is one of countless checklist use cases) and *MapTrack* (asset-centric, AI form creation, failed items → work orders). Weakness for us: data lives in forms, not on the vehicle. Caution: SafetyCulture is Australian, huge, well-funded, and could add a fleet vertical at any time — don't pick a generic-inspection fight.
- **Dedicated vehicle inspection + maintenance** — *Whip Around* (the leader; driver app, OCR odometer, defect management, mechanic e-signs corrected faults; ~$5/asset standard, $10 pro, ~$120–220/mo minimum covering the first 20 assets), *Fleetio* (maintenance-heavy, ~$4/vehicle, unlimited users), *FleetRabbit*. **This is the real competition.** US-origin and DOT/DVIR-framed (a truck frame) — which is exactly the gap LV + WHS framing exploits.
- **Telematics suites** — *Geotab, Teletrac Navman, EROAD, Samsara, Motive, Verizon Connect.* Inspection is a bolt-on to a big, hardware-tied, $500+ enterprise platform. Out of the ring for LV.
- **Australian compliance-fleet** — *Hubfleet* (the closest direct rival, but **heavy-vehicle**: HVNL, WA Worksafe, full fault→work-order→close, offline permits), *Kynection* (compliance-first, "no data silos"), *Fleetcheck*. LV-first sidesteps the HV ones.
- **The real default competitor:** paper and spreadsheets — still what most sub-50-vehicle LV fleets run on.

**Positioning grid (where we genuinely stand):**

| Axis | Fleetpass | SafetyCulture | Whip Around | Hubfleet |
|---|---|---|---|---|
| Australian WHS framing | **Leads** | Capable | Weak | Leads |
| Worker speed / ease of use | **Leads** | Capable | Capable | Capable |
| Per-tenant data isolation | **Leads** | Weak | Weak | Weak |
| Audit export (regulator-ready) | **Leads** | Capable | Capable | Leads |
| Price fit (5–50 vehicles) | **Leads** | Capable | Capable | Capable |
| Defect close-loop | Capable (parity) | Capable | Leads | Leads |
| Maintenance depth | Behind | Weak | Leads | Leads |
| Maturity & breadth | Behind | Leads | Leads | Leads |

**How to win (the green rows):** speak Australian WHS / duty of care, not US DOT; obsess over the worker's 90 seconds (incumbents won't rebuild their worker UX); make per-tenant isolation the procurement-winning security pitch; own the price gap; over-build the audit export. **What not to do:** don't headline the defect close-loop as unique (parity), and don't try to out-feature mature platforms on maintenance depth or breadth. Win narrow and deep for the one buyer.

---

## 22. Design language (product UI)

**Locked (see §16):** name & "pass" product language, palette (ink-teal `#0E4A40` + green `#1D9E75`, no hi-vis orange), the chevron responsive mark, the Archivo · Hanken Grotesk · IBM Plex Mono stack, the pass cascade motion, and the "mono = data only" rule.

**Still open — in priority order (the first three unblock the worker app):**
1. **Status colours** — the most important and most product-specific: Pass / Fail / N/A plus the per-org severity categories (Cat A/B/C, hazard/fire). Must be **colour-blind-safe** — pair colour with shape/icon, never colour alone, because pass/fail on a safety tool can't be ambiguous.
2. **Type scale & the figure treatment** — sizes/weights off Archivo/Hanken; tabular figures (IBM Plex Mono) for odometer/km/dates.
3. **Spacing & tap targets** — glove-and-5am sizing: minimum target sizes, big buttons, density rules for the field UI.
4. **The component kit** — the signature Pass/Fail/N/A control, status badges (open defect, Cat A, resolved), the vehicle card, the checklist row, the odometer entry, plus the dashboard side (tiles, tables, toasts, modals, empty states). Lock the icon set (Tabler) and the recurring icons (vehicle types, hazard, spanner, calendar, fuel).
5. **The two skins** — bright, high-contrast worker app vs the calmer, denser supervisor dashboard. Same brand, two contexts, defined deliberately.
6. **The offline / sync indicator** — a first-class element (offline-first product), not an afterthought; bound to Firestore's pending/synced/offline flags (§5).
7. **PDF / report design** — its own (print, not screen) language for the compliance export, work order, and service report, each with the tenant's letterhead. **This is the artifact being sold — overbuild it.**
8. **Finishing layer** — tenant co-branding rules (customer logo/colour over Fleetpass without clashing), and a short voice-and-tone guide (plain, active, Australian; "today's pass" language).

---

## 23. Marketing site & positioning copy

**Purpose:** the marketing site's one job pre-launch is to **gauge demand — collect early-access emails.** The signup list is the validation signal (real work emails from real fleet managers beat any amount of building). Everything funnels to that CTA.

**Status:** a full scrolling landing page is built and deployable (self-contained `index.html`, brand applied, LV-framed copy, the pass animation on form submit, two early-access capture points, a customisation section). **Open:** the form currently targets a Supabase placeholder and must move to **Firestore** (`early_access` collection {email, fleet_size, source, created_at}, insert-only security rule so signups can't be read publicly); drop in the final logo; deploy to Firebase Hosting. Nice-to-haves before launch: a short FAQ (data location, after-trial, offline), OG/social meta + the chevron favicon, and a light analytics snippet.

**Locked positioning copy:**
- **Value prop (one line):** Fleetpass is the prestart app your crew will actually use — and the audit trail that gets you through a WHS inspection in 30 seconds.
- **Hero headline:** *Faster than paper for the crew. Audit-ready for you.*
- **Subhead:** Fleetpass turns the paper prestart book into a 90-second check your operators won't fight — then keeps every check, fault and fix as a tamper-proof record you can hand a regulator on the spot. Australian WHS by design.
- **The wedge line:** Fleet software is all built for trucks. Fleetpass is built for the utes.
- **Proof points:** 90 seconds, no login (5am and gloves) · Australian WHS / duty of care, not US DOT · nothing slips through, operator → mechanic → closed · your data stays in its own database · audit any vehicle in 30 seconds.
- **Customisation triad:** *Your site. Your needs. Your prestarts.* — templates built to match the forms you already run, the hazard categories that matter to you, your logo and colours on it.
- **Pricing teaser (public):** Starter $99/≤15, Professional $299/≤50, Enterprise = let's talk; billed by vehicle (crew free), 30-day free trial, no card.

**Page structure:** nav → hero (headline + capture) → the gap ("built for trucks, your utes got left behind") → what you get (the green-column proof points) → customisation → how it works (the four-screen flow + the close-the-loop line) → who it's for → pricing → final early-access CTA → footer.
