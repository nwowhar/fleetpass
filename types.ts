// packages/shared/src/types.ts
//
// The canonical Fleetpass domain schema (architecture doc §2). Every app
// (worker, dashboard, console) and every Cloud Function imports these same
// interfaces — a field rename here is a compile error everywhere else,
// not a runtime surprise.

/**
 * `Timestamp` is referenced throughout this file as "= Firestore Timestamp"
 * (§2), but the client SDK (`firebase/firestore`) and the Admin SDK
 * (`firebase-admin/firestore`) ship *different* Timestamp classes with the
 * same shape. Rather than pick one and force every consumer of this
 * SDK-agnostic package to depend on it, we declare the structural shape
 * both real classes satisfy. A real `Timestamp` from either SDK is a valid
 * value here with zero casting; nothing in `packages/shared` needs to know
 * which SDK produced it.
 */
export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

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
