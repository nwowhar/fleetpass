// packages/shared/src/cascade.ts
//
// The checklist-template cascade (build plan §8): "a checklist template
// lives at the org level by default and applies to every vehicle; optional
// site or vehicle-type overrides sit beneath it. A vehicle uses the most
// specific template that applies (type -> site -> org default)."
//
// This is deliberately a pure function with no Firestore calls in it.
// Fetching the candidate templates (the org default, a site override if
// one exists, any vehicleType-scoped templates) is the caller's job —
// the worker app, the dashboard's checklist editor, and any server-side
// function (e.g. exportAudit rendering historical templateVersion) all
// fetch differently but resolve identically by calling this.

import type { ChecklistTemplate } from './types.js';

export interface ResolveChecklistTemplateInput {
  /** The vehicle's `type` field — selects a vehicleType override, if one exists. */
  vehicleType: string;

  /** Always present — every org has a default book (§8). Resolution falls back to this. */
  orgDefault: ChecklistTemplate;

  /** A site-level override (`scope: 'site'`), if the org/site has one. */
  siteOverride?: ChecklistTemplate;

  /**
   * Any vehicleType-scoped templates (`scope: 'vehicleType'`) visible to this
   * vehicle — typically queried separately (e.g. `where('scope','==','vehicleType')`)
   * at the org or site level. The resolver picks the one whose `vehicleType`
   * matches; an org/site may hold several (one per type), or none.
   */
  vehicleTypeTemplates?: ChecklistTemplate[];
}

/**
 * Resolve the single template a vehicle should use right now.
 *
 * Precedence, most specific first: a matching vehicleType template, then a
 * site override, then the org default. This is the only place that
 * precedence logic should live — the worker app's picker, the dashboard's
 * checklist editor preview, and any server-side rendering must all call
 * this rather than re-implement the order themselves.
 */
export function resolveChecklistTemplate(
  input: ResolveChecklistTemplateInput
): ChecklistTemplate {
  const typeMatch = input.vehicleTypeTemplates?.find(
    (template) => template.vehicleType === input.vehicleType
  );
  if (typeMatch) return typeMatch;

  if (input.siteOverride) return input.siteOverride;

  return input.orgDefault;
}
