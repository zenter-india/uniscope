/** "District, City, State" for a college row, skipping blanks and repeats
 * (district and city are often the same word). Hospital-type colleges such
 * as "District Hospital" repeat one name across many districts and have no
 * city, so the district is what tells them apart. `district` comes from the
 * backend's admin list; older/other responses without it just fall back to
 * city + state. */
export function locationLabel(c: {
  district?: string | null;
  city: string | null;
  state: string;
}): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [c.district, c.city, c.state]) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  return parts.join(', ');
}
