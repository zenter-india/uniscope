import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Msg91OtpProvider } from './msg91-otp.provider.js';

describe('Msg91OtpProvider network failures', () => {
  const config = {
    get: () => ({ authKey: 'test-key', templateId: 'test-template' }),
  } as unknown as ConfigService;

  const realFetch = global.fetch;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
  });

  afterEach(() => {
    global.fetch = realFetch;
    errorSpy.mockRestore();
  });

  it('sendOtp maps an unreachable MSG91 to 503, not a raw TypeError', async () => {
    const provider = new Msg91OtpProvider(config);
    await expect(provider.sendOtp('+919876543210')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('verifyOtp maps an unreachable MSG91 to 503, not a raw TypeError', async () => {
    const provider = new Msg91OtpProvider(config);
    await expect(
      provider.verifyOtp('+919876543210', '123456', 'test-template'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('passes an abort signal so a hung request times out', async () => {
    const provider = new Msg91OtpProvider(config);
    await provider.sendOtp('+919876543210').catch(() => undefined);
    const fetchMock = global.fetch as unknown as jest.Mock<
      Promise<Response>,
      [string, RequestInit]
    >;
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
