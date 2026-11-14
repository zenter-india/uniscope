import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AliasAvailableDto } from './dto/alias-available.dto';
import { EnrollmentsService } from './enrollments.service';

function serviceWith(found: { id: string } | null) {
  const findFirst = jest.fn().mockResolvedValue(found);
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    prisma: { user: { findFirst } },
  }) as EnrollmentsService;
  return { svc, findFirst };
}

describe('EnrollmentsService.isAliasAvailable', () => {
  it('is available when nobody has the name', async () => {
    const { svc } = serviceWith(null);
    await expect(svc.isAliasAvailable('Naveen')).resolves.toEqual({
      available: true,
    });
  });

  it('is not available when someone has it', async () => {
    const { svc } = serviceWith({ id: 'u1' });
    await expect(svc.isAliasAvailable('John')).resolves.toEqual({
      available: false,
    });
  });

  it('compares ignoring letter case, after trimming', async () => {
    const { svc, findFirst } = serviceWith(null);
    await svc.isAliasAvailable('  john ');
    expect(findFirst).toHaveBeenCalledWith({
      where: { displayName: { equals: 'john', mode: 'insensitive' } },
      select: { id: true },
    });
  });

  it('answers only yes or no, never who has the name', async () => {
    const { svc } = serviceWith({ id: 'secret-user-id' });
    const result = await svc.isAliasAvailable('John');
    expect(Object.keys(result)).toEqual(['available']);
    expect(JSON.stringify(result)).not.toContain('secret-user-id');
  });
});

describe('AliasAvailableDto', () => {
  const check = (alias: unknown) =>
    validate(plainToInstance(AliasAvailableDto, { alias }));

  it('accepts a normal alias, trimmed', async () => {
    expect(await check('  Naveen ')).toHaveLength(0);
    expect(
      plainToInstance(AliasAvailableDto, { alias: '  Naveen ' }).alias,
    ).toBe('Naveen');
  });

  it('rejects an alias that is too short, too long or missing', async () => {
    expect(await check('a')).not.toHaveLength(0);
    expect(await check('a'.repeat(61))).not.toHaveLength(0);
    expect(await check(undefined)).not.toHaveLength(0);
  });
});
