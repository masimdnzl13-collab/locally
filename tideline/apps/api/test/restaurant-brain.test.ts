import { describe, expect, it } from 'vitest';
import { brainSchemas } from '../src/services/restaurant-brain-service.js';

describe('PostgreSQL Restaurant Brain schemas', () => {
  it('accepts bilingual profile and integer-cent menu data', () => {
    expect(brainSchemas.profile.parse({ name: 'Harbor House', timezone: 'America/New_York', defaultLanguage: 'EN', supportedLanguages: ['EN', 'ES'] }).supportedLanguages).toEqual(['EN', 'ES']);
    expect(brainSchemas.item.parse({ categoryId: '00000000-0000-0000-0000-000000000001', name: 'Soup', priceCents: 1250 }).priceCents).toBe(1250);
  });
  it('rejects invalid money and invalid language values', () => {
    expect(() => brainSchemas.item.parse({ categoryId: '00000000-0000-0000-0000-000000000001', name: 'Soup', priceCents: 12.5 })).toThrow();
    expect(() => brainSchemas.profile.parse({ name: 'Cafe', timezone: 'UTC', defaultLanguage: 'FR', supportedLanguages: ['FR'] })).toThrow();
  });
  it('rejects contradictory hours and partial closures', () => {
    expect(() => brainSchemas.hours.parse({ weekday: 1, startTime: '22:00', endTime: '10:00' })).toThrow();
    expect(() => brainSchemas.closures.parse({ closureDate: '2026-09-21', startTime: '10:00', reason: 'maintenance' })).toThrow();
  });
  it('rejects contradictory reservation settings', () => {
    expect(() => brainSchemas.settings.parse({ reservationRules: { minimumPartySize: 8, maximumPartySize: 2 } })).toThrow();
  });
});
