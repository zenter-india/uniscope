import { normalizePermissions } from './admin-permissions.js';

describe('normalizePermissions', () => {
  it('keeps well-formed keys, sorted and without duplicates', () => {
    expect(
      normalizePermissions(['users:view', 'payouts:view', 'users:view']),
    ).toEqual(['payouts:view', 'users:view']);
  });

  it('makes edit imply view', () => {
    expect(normalizePermissions(['users:edit'])).toEqual([
      'users:edit',
      'users:view',
    ]);
  });

  it('drops malformed keys, unknown actions and blanks', () => {
    expect(
      normalizePermissions([
        '',
        'users',
        'users:delete',
        'Users:View ',
        ':view',
        'users:view:extra',
        'a b:view',
      ]),
    ).toEqual(['users:view']);
  });

  it('returns an empty list for no input', () => {
    expect(normalizePermissions([])).toEqual([]);
  });
});
