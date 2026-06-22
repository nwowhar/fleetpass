// packages/shared/src/cascade.test.ts

import { describe, expect, it } from 'vitest';
import { resolveChecklistTemplate } from './cascade.js';
import type { ChecklistTemplate, Timestamp } from './types.js';

// Minimal fake Timestamp — satisfies the structural type without depending
// on either Firebase SDK (see the comment on `Timestamp` in types.ts).
function fakeTimestamp(): Timestamp {
  const date = new Date('2026-06-20T00:00:00Z');
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

function makeTemplate(
  name: string,
  scope: ChecklistTemplate['scope'],
  vehicleType?: string
): ChecklistTemplate {
  return {
    name,
    scope,
    vehicleType,
    categories: [],
    items: [],
    version: 1,
    updatedAt: fakeTimestamp(),
  };
}

describe('resolveChecklistTemplate', () => {
  const orgDefault = makeTemplate('Org Default Book', 'org');

  it('falls back to the org default when nothing more specific exists', () => {
    const result = resolveChecklistTemplate({
      vehicleType: 'ute',
      orgDefault,
    });

    expect(result).toBe(orgDefault);
  });

  it('prefers a site override over the org default', () => {
    const siteOverride = makeTemplate('Site Override Book', 'site');

    const result = resolveChecklistTemplate({
      vehicleType: 'ute',
      orgDefault,
      siteOverride,
    });

    expect(result).toBe(siteOverride);
  });

  it('prefers a matching vehicleType template over a site override', () => {
    const siteOverride = makeTemplate('Site Override Book', 'site');
    const utelOverride = makeTemplate('Ute Book', 'vehicleType', 'ute');
    const truckOverride = makeTemplate('Truck Book', 'vehicleType', 'truck');

    const result = resolveChecklistTemplate({
      vehicleType: 'ute',
      orgDefault,
      siteOverride,
      vehicleTypeTemplates: [truckOverride, utelOverride],
    });

    expect(result).toBe(utelOverride);
  });

  it('falls through to the site override when no vehicleType template matches', () => {
    const siteOverride = makeTemplate('Site Override Book', 'site');
    const truckOverride = makeTemplate('Truck Book', 'vehicleType', 'truck');

    const result = resolveChecklistTemplate({
      vehicleType: 'ute', // no 'ute' entry in vehicleTypeTemplates below
      orgDefault,
      siteOverride,
      vehicleTypeTemplates: [truckOverride],
    });

    expect(result).toBe(siteOverride);
  });

  it('falls through to the org default when neither a vehicleType match nor a site override exists', () => {
    const truckOverride = makeTemplate('Truck Book', 'vehicleType', 'truck');

    const result = resolveChecklistTemplate({
      vehicleType: 'ute',
      orgDefault,
      vehicleTypeTemplates: [truckOverride],
    });

    expect(result).toBe(orgDefault);
  });

  it('prefers a matching vehicleType template even with no site override present', () => {
    const utelOverride = makeTemplate('Ute Book', 'vehicleType', 'ute');

    const result = resolveChecklistTemplate({
      vehicleType: 'ute',
      orgDefault,
      vehicleTypeTemplates: [utelOverride],
    });

    expect(result).toBe(utelOverride);
  });
});
