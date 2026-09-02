import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionStatus, SessionType } from '@prisma/client';
import { ChatController } from './chat.controller.js';

// Authorization boundary for CHAT-session messaging (see AUTHZ-002-style
// coverage elsewhere in this project): a caller must be a real party to the
// session, the session must actually be a CHAT session in a chattable
// status, and neither party may send while the other side of a mutual
// block is in effect. Reading history stays available through a block —
// only sendMessage is gated (see ChatController doc comment).
describe('ChatController', () => {
  const sessionId = 's1';
  const aspirantId = 'aspirant-1';
  const mentorId = 'mentor-1';
  const strangerId = 'stranger-1';

  function baseSession(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: sessionId,
      aspirantId,
      mentorId,
      type: SessionType.CHAT,
      status: SessionStatus.ACCEPTED,
      ...overrides,
    };
  }

  function controllerWith({
    session,
    isBlocked = false,
  }: {
    session: ReturnType<typeof baseSession> | null;
    isBlocked?: boolean;
  }) {
    const prisma = {
      session: {
        findFirst: jest.fn().mockResolvedValue(session),
      },
    } as any;
    const chatService = {
      ensureChannelForSession: jest.fn().mockResolvedValue({ id: 'channel-1' }),
      listMessages: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
      sendMessage: jest.fn().mockResolvedValue({ id: 'm1' }),
      connectionInfo: jest.fn().mockReturnValue({}),
    } as any;
    const blocksService = {
      isBlockedEitherDirection: jest.fn().mockResolvedValue(isBlocked),
    } as any;
    return new ChatController(chatService, blocksService, prisma);
  }

  it('404s a caller who is not a party to the session (existence not leaked)', async () => {
    // findFirst's own where clause already filters to sessions the caller
    // is a party to — a non-party's lookup finds nothing, indistinguishable
    // from the session simply not existing.
    const controller = controllerWith({ session: null });
    await expect(
      controller.listMessages(sessionId, { sub: strangerId } as any, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('403s a participant on a session that is not a CHAT session', async () => {
    const controller = controllerWith({
      session: baseSession({ type: SessionType.AUDIO_CALL }),
    });
    await expect(
      controller.listMessages(sessionId, { sub: aspirantId } as any, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([SessionStatus.PENDING, SessionStatus.REJECTED, SessionStatus.EXPIRED])(
    '403s a participant while the session is %s (not yet/no longer chattable)',
    async (status) => {
      const controller = controllerWith({ session: baseSession({ status }) });
      await expect(
        controller.listMessages(sessionId, { sub: aspirantId } as any, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([SessionStatus.ACCEPTED, SessionStatus.IN_PROGRESS, SessionStatus.COMPLETED])(
    'allows a participant to read history while the session is %s',
    async (status) => {
      const controller = controllerWith({ session: baseSession({ status }) });
      await expect(
        controller.listMessages(sessionId, { sub: aspirantId } as any, {}),
      ).resolves.toBeDefined();
    },
  );

  it('lets either participant read history even if the pair has since blocked each other', async () => {
    const controller = controllerWith({ session: baseSession(), isBlocked: true });
    await expect(
      controller.listMessages(sessionId, { sub: aspirantId } as any, {}),
    ).resolves.toBeDefined();
  });

  it('403s sendMessage when the pair has blocked each other (either party, either direction)', async () => {
    const controller = controllerWith({ session: baseSession(), isBlocked: true });
    await expect(
      controller.sendMessage(sessionId, { sub: aspirantId } as any, {
        text: 'hi',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.sendMessage(sessionId, { sub: mentorId } as any, {
        text: 'hi',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends successfully for an unblocked participant', async () => {
    const controller = controllerWith({ session: baseSession() });
    const result = await controller.sendMessage(
      sessionId,
      { sub: aspirantId } as any,
      { text: 'hello' },
    );
    expect(result).toEqual({ id: 'm1' });
  });
});
