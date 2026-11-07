import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CustomDegreesService, tidyDegreeName } from './custom-degrees.service';

function makeService(prisma: Record<string, unknown>) {
  return new CustomDegreesService(prisma as never);
}

describe('tidyDegreeName', () => {
  it('trims, collapses spaces and lower-cases the key only', () => {
    expect(tidyDegreeName('  B.Pharm   (Hons) ')).toEqual({
      name: 'B.Pharm (Hons)',
      nameKey: 'b.pharm (hons)',
    });
  });
});

describe('CustomDegreesService.submit', () => {
  it('upserts by (stream, lower-cased name) and only bumps the count on repeats', async () => {
    const upsert = jest.fn().mockResolvedValue({ status: 'PENDING' });
    const svc = makeService({ customDegree: { upsert } });

    const res = await svc.submit('u1', { stream: 'Medical', name: '  Optometry  ' });

    expect(res).toEqual({ status: 'PENDING' });
    expect(upsert).toHaveBeenCalledWith({
      where: { stream_nameKey: { stream: 'Medical', nameKey: 'optometry' } },
      create: {
        stream: 'Medical',
        name: 'Optometry',
        nameKey: 'optometry',
        firstSubmittedBy: 'u1',
      },
      update: { submissionCount: { increment: 1 } },
    });
  });

  it('rejects the catch-all names', async () => {
    const upsert = jest.fn();
    const svc = makeService({ customDegree: { upsert } });
    await expect(svc.submit('u1', { stream: 'Law', name: ' Others ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('CustomDegreesService.review', () => {
  const row = {
    id: 'd1',
    stream: 'Medical',
    name: 'optometry',
    nameKey: 'optometry',
    status: 'PENDING',
    submissionCount: 3,
    createdAt: new Date('2026-11-01'),
    reviewedAt: null,
  };

  it('404s for an unknown id', async () => {
    const svc = makeService({ customDegree: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc.review('x', 'admin', { status: 'APPROVED' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('approves with a corrected spelling and stamps the reviewer', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(row) // the row being reviewed
      .mockResolvedValueOnce(null); // no clash for the new key
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...row, ...data }));
    const svc = makeService({ customDegree: { findUnique, update } });

    const res = await svc.review('d1', 'admin1', { status: 'APPROVED', name: 'Optometry (B.Optom)' });

    expect(res.name).toBe('Optometry (B.Optom)');
    expect(res.status).toBe('APPROVED');
    const data = update.mock.calls[0][0].data;
    expect(data.nameKey).toBe('optometry (b.optom)');
    expect(data.reviewedBy).toBe('admin1');
    expect(data.reviewedAt).toBeInstanceOf(Date);
  });

  it('409s when the corrected name already exists in that stream', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, id: 'd2', name: 'B.Optom', nameKey: 'b.optom' });
    const svc = makeService({ customDegree: { findUnique, update: jest.fn() } });
    await expect(
      svc.review('d1', 'admin1', { status: 'APPROVED', name: 'B.Optom' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('un-reviewing (back to PENDING) clears the reviewer', async () => {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...row, ...data }));
    const svc = makeService({
      customDegree: { findUnique: jest.fn().mockResolvedValue(row), update },
    });
    await svc.review('d1', 'admin1', { status: 'PENDING' });
    const data = update.mock.calls[0][0].data;
    expect(data.reviewedBy).toBeNull();
    expect(data.reviewedAt).toBeNull();
  });
});
