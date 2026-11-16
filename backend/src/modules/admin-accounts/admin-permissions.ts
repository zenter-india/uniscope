/** Permission keys for admin-panel accounts: "<section>:view" opens a section
 * of the panel, "<section>:edit" lets the admin change things in it. The list
 * of sections lives in the admin app (admin/lib/permissions.ts); the backend
 * only checks the shape so a new section never needs a backend change. */
export const PERMISSION_KEY = /^[a-z][a-z-]{0,39}:(view|edit)$/;
export const MAX_PERMISSIONS = 100;

/** Cleans a submitted list: drops duplicates and anything that is not a
 * well-formed key, and makes "edit" imply "view" (you cannot change a page
 * you cannot open). Returns a sorted list so saving the same choices twice
 * stores the same value. */
export function normalizePermissions(keys: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of keys) {
    const key = raw.trim().toLowerCase();
    if (!PERMISSION_KEY.test(key)) continue;
    out.add(key);
    if (key.endsWith(':edit')) out.add(`${key.slice(0, -5)}:view`);
  }
  return [...out].sort();
}
