/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return --
 * Mocks collaborators and inspects the arguments they were called with. */
import { EnrollmentsService } from './enrollments.service';
import {
  customDegreeToQueue,
  specializationToQueue,
} from './lead-custom-options';

describe('customDegreeToQueue — which typed courses go to an admin', () => {
  it('queues a course typed under "Others"', () => {
    expect(
      customDegreeToQueue('Arts & Humanities', '  B.Sc   Nursing '),
    ).toEqual({ stream: 'Arts & Humanities', name: 'B.Sc Nursing' });
  });

  it('ignores the built-in choices, in any letter case', () => {
    expect(customDegreeToQueue('Medical', 'MD/MS')).toBeNull();
    expect(customDegreeToQueue('Medical', 'dnb')).toBeNull();
    expect(customDegreeToQueue('Engineering', 'B.Tech/B.E')).toBeNull();
    expect(customDegreeToQueue('Dental', 'MDS')).toBeNull();
    expect(customDegreeToQueue('Law', 'UG')).toBeNull();
    expect(customDegreeToQueue('Design', 'Higher Secondary (12th)')).toBeNull();
  });

  it('ignores the catch-all and empty values', () => {
    expect(customDegreeToQueue('Law', 'Others')).toBeNull();
    expect(customDegreeToQueue('Law', 'other')).toBeNull();
    expect(customDegreeToQueue('Law', '')).toBeNull();
    expect(customDegreeToQueue('Law', undefined)).toBeNull();
    expect(customDegreeToQueue('Law', 'x')).toBeNull();
  });

  it('ignores a free-typed stream and odd characters', () => {
    expect(customDegreeToQueue('Culinary Arts', 'Pastry Diploma')).toBeNull();
    expect(customDegreeToQueue(undefined, 'Pastry Diploma')).toBeNull();
    expect(customDegreeToQueue('Law', 'LLB <script>')).toBeNull();
    expect(customDegreeToQueue('Law', 'a'.repeat(51))).toBeNull();
  });
});

describe('specializationToQueue', () => {
  it('keeps a plausible name, tidied', () => {
    expect(specializationToQueue('  MD -  Pediatrics ')).toBe(
      'MD - Pediatrics',
    );
  });

  it('drops empty, too long, catch-all and odd values', () => {
    expect(specializationToQueue(undefined)).toBeNull();
    expect(specializationToQueue(' ')).toBeNull();
    expect(specializationToQueue('Others')).toBeNull();
    expect(specializationToQueue('a'.repeat(101))).toBeNull();
    expect(specializationToQueue('MD; DROP TABLE')).toBeNull();
  });
});

function setup() {
  const customDegrees = {
    submit: jest.fn().mockResolvedValue({ status: 'PENDING' }),
  };
  const specializationSuggestions = {
    submit: jest.fn().mockResolvedValue({ status: 'PENDING' }),
  };
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    customDegrees,
    specializationSuggestions,
    logger: { warn: jest.fn(), error: jest.fn() },
  }) as EnrollmentsService;
  return { svc, customDegrees, specializationSuggestions };
}

const queue = (svc: EnrollmentsService, choices: object) =>
  (svc as any).queueTypedChoices('user-1', choices);
const keyFor = (svc: EnrollmentsService, stream?: string, degree?: string) =>
  (svc as any).curatedDegreeKey(stream, degree);

describe('website sign-up — typed course and specialization reach the admin queues', () => {
  it('queues a typed course for the new account', async () => {
    const { svc, customDegrees } = setup();
    await queue(svc, { stream: 'Commerce & Business', degree: 'CA Final' });
    expect(customDegrees.submit).toHaveBeenCalledWith('user-1', {
      stream: 'Commerce & Business',
      name: 'CA Final',
    });
  });

  it('does not queue a built-in course', async () => {
    const { svc, customDegrees } = setup();
    await queue(svc, { stream: 'Medical', degree: 'MD/MS' });
    expect(customDegrees.submit).not.toHaveBeenCalled();
  });

  it("queues a typed specialization against the mentor's college and curated degree", async () => {
    const { svc, specializationSuggestions } = setup();
    await queue(svc, {
      stream: 'Medical',
      degree: 'PG',
      universityId: 'college-1',
      degreeKey: keyFor(svc, 'Medical', 'PG'),
      specialization: 'MD - Pediatrics',
    });
    expect(specializationSuggestions.submit).toHaveBeenCalledWith('user-1', {
      universityId: 'college-1',
      degree: 'MD/MS',
      name: 'MD - Pediatrics',
    });
  });

  it('skips the specialization with no college or no curated degree', async () => {
    const { svc, specializationSuggestions } = setup();
    await queue(svc, { degreeKey: 'MD/MS', specialization: 'MD - X' });
    await queue(svc, { universityId: 'college-1', specialization: 'MD - X' });
    expect(specializationSuggestions.submit).not.toHaveBeenCalled();
  });

  it('never throws when an approval service rejects', async () => {
    const { svc, customDegrees, specializationSuggestions } = setup();
    customDegrees.submit.mockRejectedValue(new Error('boom'));
    specializationSuggestions.submit.mockRejectedValue(
      new Error('not a mentor'),
    );
    await expect(
      queue(svc, {
        stream: 'Law',
        degree: 'Legal Practice Course',
        universityId: 'c',
        degreeKey: 'LAW-UG',
        specialization: 'Tax Law',
      }),
    ).resolves.toBeUndefined();
  });

  it('maps degrees to the curated key, and skips ones with no college list', () => {
    const { svc } = setup();
    expect(keyFor(svc, 'Medical', 'PG')).toBe('MD/MS');
    expect(keyFor(svc, 'Engineering', 'B.Tech/B.E')).toBe('B.TECH');
    expect(keyFor(svc, 'Dental', 'MDS')).toBe('MDS');
    expect(keyFor(svc, 'Medical', 'Doctorate')).toBeNull();
    expect(keyFor(svc, 'Medical', 'Others')).toBeNull();
    expect(keyFor(svc, 'Design', 'UG')).toBeNull();
    expect(keyFor(svc, undefined, 'PG')).toBeNull();
  });
});
