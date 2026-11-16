/** Longest display name the database allows (users.display_name VARCHAR(60)). */
export const DISPLAY_NAME_MAX = 60;

/** The n-th choice for a wanted name: n = 0 is the name itself, then the name
 * followed by 1, 2, 3 … ("John", "John1", "John2"). The name is shortened when
 * needed so the number always fits in the 60 characters the database allows. */
export function nthDisplayName(base: string, n: number): string {
  const name = base.trim();
  if (n <= 0) return name.slice(0, DISPLAY_NAME_MAX).trimEnd();
  const suffix = String(n);
  return `${name.slice(0, DISPLAY_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
}

/** The first of `candidates` that nobody has, comparing without regard to
 * letter case (the database enforces it the same way). */
export function firstFreeDisplayName(
  candidates: readonly string[],
  taken: Iterable<string>,
): string | null {
  const takenLower = new Set<string>();
  for (const t of taken) takenLower.add(t.toLowerCase());
  return candidates.find((c) => !takenLower.has(c.toLowerCase())) ?? null;
}
