/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * Inspects the arguments a jest mock was called with. */
import { BadRequestException } from '@nestjs/common';
import { VerificationService } from './verification.service';

const request = {
  id: 'r1',
  userId: 'u1',
  universityId: 'c1',
  status: 'SUBMITTED',
};

function build(over: { prepare?: jest.Mock; apply?: jest.Mock } = {}) {
  const prisma = {
    verificationRequest: {
      findUnique: jest.fn().mockResolvedValue(request),
      update: jest.fn().mockResolvedValue({
        ...request,
        status: 'VERIFIED',
        reviewNote: null,
        submittedAt: null,
        reviewedAt: new Date(),
        createdAt: new Date(),
        documentType: 'STUDENT_ID',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    userProfile: { updateMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const specializations = {
    prepareApprovalChoice: over.prepare ?? jest.fn().mockResolvedValue(null),
    applyApprovalChoice: over.apply ?? jest.fn().mockResolvedValue(undefined),
    forApplicants: jest.fn().mockResolvedValue([]),
  };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new VerificationService(
    prisma as never,
    notifications as never,
    specializations as never,
    {} as never,
  );
  return { service, prisma, specializations, notifications };
}

describe('VerificationService.review — specialization suggestion choice', () => {
  it("passes the admin's choice through and applies it after approving", async () => {
    const choice = { suggestionId: 's1', mode: 'USE', useName: 'Anatomy' };
    const { service, specializations, prisma } = build({
      prepare: jest.fn().mockResolvedValue(choice),
    });
    await service.review('r1', 'admin1', {
      approve: true,
      useSpecialization: 'anatomy',
    });
    expect(specializations.prepareApprovalChoice).toHaveBeenCalledWith(
      'u1',
      'c1',
      { addSuggested: undefined, useName: 'anatomy' },
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(specializations.applyApprovalChoice).toHaveBeenCalledWith(
      choice,
      'admin1',
      'u1',
    );
  });

  it('fails the approval before changing anything when the choice is invalid', async () => {
    const { service, prisma, specializations } = build({
      prepare: jest.fn().mockRejectedValue(new BadRequestException('nope')),
    });
    await expect(
      service.review('r1', 'admin1', { approve: true, useSpecialization: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(specializations.applyApprovalChoice).not.toHaveBeenCalled();
  });

  it('ignores the choice when rejecting the profile', async () => {
    const { service, specializations } = build();
    await service.review('r1', 'admin1', {
      approve: false,
      addSuggestedSpecialization: true,
    });
    expect(specializations.prepareApprovalChoice).not.toHaveBeenCalled();
    expect(specializations.applyApprovalChoice).not.toHaveBeenCalled();
  });

  it('keeps the approval even if applying the choice fails afterwards', async () => {
    const { service, notifications } = build({
      prepare: jest
        .fn()
        .mockResolvedValue({ suggestionId: 's1', mode: 'ADD' }),
      apply: jest.fn().mockRejectedValue(new Error('db blip')),
    });
    await expect(
      service.review('r1', 'admin1', {
        approve: true,
        addSuggestedSpecialization: true,
      }),
    ).resolves.toBeDefined();
    expect(notifications.send).toHaveBeenCalled();
  });
});
