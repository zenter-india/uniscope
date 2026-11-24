export type CsvCell = string | number | null | undefined;

/** The byte-order mark. Built from its code (not typed into the source) so it
 * is visible to a reader and to the linter. */
export const CSV_BOM = String.fromCharCode(0xfeff);

/** Excel / Sheets read a leading "=", "+", "-", "@" (and a tab or carriage
 * return) as a formula, so a crafted display name could run on whoever opens
 * the file. Text cells starting with one get a quote in front, which still
 * shows the original text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  // Numbers are ours (sums and counts), never user text: written as they are,
  // so a negative amount stays a number instead of being quoted as a formula.
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * A CSV with a header row. It starts with a byte-order mark so Excel opens the
 * names as UTF-8 instead of garbling anything that is not plain English.
 */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly (readonly [string, (row: T) => CsvCell])[],
): string {
  const header = columns.map(([name]) => cell(name)).join(',');
  const body = rows
    .map((row) => columns.map(([, get]) => cell(get(row))).join(','))
    .join('\n');
  return `${CSV_BOM}${header}${body ? `\n${body}` : ''}`;
}
