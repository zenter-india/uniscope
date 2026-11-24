import { CSV_BOM, toCsv } from './money-csv';

type Row = { name: string | null; n: number | null };
const cols = [
  ['Name', (r: Row) => r.name],
  ['Amount', (r: Row) => r.n],
] as const;

describe('toCsv', () => {
  it('starts with a byte-order mark so Excel reads UTF-8', () => {
    expect(CSV_BOM).toHaveLength(1);
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff);
    expect(toCsv<Row>([], cols).startsWith(CSV_BOM)).toBe(true);
  });

  it('writes a quoted header and rows, numbers unquoted', () => {
    const csv = toCsv<Row>([{ name: 'Asha', n: 250 }], cols);
    expect(csv).toBe(`${CSV_BOM}"Name","Amount"\n"Asha",250`);
  });

  it('is just the header when there are no rows', () => {
    expect(toCsv<Row>([], cols)).toBe(`${CSV_BOM}"Name","Amount"`);
  });

  it('leaves missing values empty', () => {
    const csv = toCsv<Row>([{ name: null, n: null }], cols);
    expect(csv.split('\n')[1]).toBe(',');
  });

  it('doubles quotes inside text and keeps commas and new lines inside the cell', () => {
    const csv = toCsv<Row>([{ name: 'He said "hi", twice\nok', n: 1 }], cols);
    expect(csv).toContain('"He said ""hi"", twice\nok",1');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'neutralises a name that would run as a formula: %j',
    (name) => {
      const csv = toCsv<Row>([{ name, n: 1 }], cols);
      expect(csv).toContain(`"'${name}"`);
    },
  );

  it('does not touch an ordinary name', () => {
    expect(toCsv<Row>([{ name: 'Rahul', n: 1 }], cols)).toContain('"Rahul"');
  });

  it('writes a negative number as a number, not as a quoted formula', () => {
    expect(toCsv<Row>([{ name: 'x', n: -50 }], cols)).toContain('"x",-50');
  });

  it('leaves a number that is not finite empty', () => {
    expect(toCsv<Row>([{ name: 'x', n: Number.NaN }], cols)).toContain('"x",');
  });
});
