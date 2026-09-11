/**
 * Body is `{ [settingKey]: number }` for whichever settings changed.
 * class-validator can't usefully validate an arbitrary index signature, so
 * the controller does this light manual shape-check before handing the
 * object to SettingsService.setMany, which validates each key/value against
 * the registry (unknown key or out-of-range value rejects the whole batch).
 */
export function isNumericRecord(body: unknown): body is Record<string, number> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  return Object.values(body).every((v) => typeof v === 'number' && Number.isFinite(v));
}
