import {
  DISPLAY_NAME_MAX,
  firstFreeDisplayName,
  nthDisplayName,
} from './display-name.helper.js';

describe('nthDisplayName', () => {
  it('is the name itself first, then name1, name2 …', () => {
    expect(nthDisplayName('John', 0)).toBe('John');
    expect(nthDisplayName('John', 1)).toBe('John1');
    expect(nthDisplayName('John', 2)).toBe('John2');
    expect(nthDisplayName('John', 12)).toBe('John12');
  });

  it('trims surrounding spaces', () => {
    expect(nthDisplayName('  John  ', 1)).toBe('John1');
  });

  it('keeps the whole name within 60 characters, number included', () => {
    const long = 'a'.repeat(80);
    expect(nthDisplayName(long, 0)).toHaveLength(DISPLAY_NAME_MAX);
    const withNumber = nthDisplayName(long, 12);
    expect(withNumber).toHaveLength(DISPLAY_NAME_MAX);
    expect(withNumber.endsWith('12')).toBe(true);
  });
});

describe('firstFreeDisplayName', () => {
  const candidates = ['John', 'John1', 'John2', 'John3'];

  it('returns the first candidate nobody has', () => {
    expect(firstFreeDisplayName(candidates, [])).toBe('John');
    expect(firstFreeDisplayName(candidates, ['John'])).toBe('John1');
    expect(firstFreeDisplayName(candidates, ['John', 'John1'])).toBe('John2');
  });

  it('ignores letter case, like the database does', () => {
    expect(firstFreeDisplayName(candidates, ['john', 'JOHN1'])).toBe('John2');
  });

  it('skips over a gap only when the earlier ones are taken', () => {
    expect(firstFreeDisplayName(candidates, ['John', 'John2'])).toBe('John1');
  });

  it('returns null when every candidate is taken', () => {
    expect(firstFreeDisplayName(candidates, candidates)).toBeNull();
  });
});
