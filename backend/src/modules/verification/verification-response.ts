import { VerificationRequest } from '@prisma/client';

export interface VerificationRequestResponse {
  id: string;
  userId: string;
  universityId: string;
  documentType: VerificationRequest['documentType'];
  status: VerificationRequest['status'];
  reviewNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  /** Admin-queue-only convenience fields — populated when the row was
   * fetched with the user/university relations included (see
   * VerificationService.findQueue). Undefined elsewhere. */
  userDisplayName?: string;
  universityName?: string;
}

export function toVerificationRequestResponse(
  req: VerificationRequest & {
    user?: { displayName: string };
    university?: { name: string };
  },
): VerificationRequestResponse {
  return {
    id: req.id,
    userId: req.userId,
    universityId: req.universityId,
    documentType: req.documentType,
    status: req.status,
    reviewNote: req.reviewNote,
    submittedAt: req.submittedAt,
    reviewedAt: req.reviewedAt,
    createdAt: req.createdAt,
    ...(req.user && { userDisplayName: req.user.displayName }),
    ...(req.university && { universityName: req.university.name }),
  };
}
