export type SortDir = 'asc' | 'desc';

/** A Prisma `orderBy` array — a list of single-key `{ field: dir }` objects. */
export type OrderBy = Record<string, SortDir>[];

/**
 * Turn an admin-supplied `sortBy` / `sortDir` into a Prisma `orderBy`,
 * restricted to an allowlist of column -> field mappings. Always appends
 * `{ id: 'asc' }` as a unique tiebreaker so cursor pagination
 * (`cursor: { id }`) stays stable regardless of the primary sort.
 *
 * `allow` maps the client-facing column key to the Prisma field name (they
 * differ, e.g. `joined` -> `createdAt`). `fallback` is the default order
 * used when `sortBy` is absent or not in the allowlist.
 */
export function adminOrderBy(
  sortBy: string | undefined,
  sortDir: SortDir | undefined,
  allow: Record<string, string>,
  fallback: Record<string, SortDir> = { createdAt: 'desc' },
): OrderBy {
  const dir: SortDir = sortDir === 'asc' ? 'asc' : 'desc';
  const field = sortBy && Object.prototype.hasOwnProperty.call(allow, sortBy) ? allow[sortBy] : null;
  return field ? [{ [field]: dir }, { id: 'asc' }] : [{ ...fallback }, { id: 'asc' }];
}
