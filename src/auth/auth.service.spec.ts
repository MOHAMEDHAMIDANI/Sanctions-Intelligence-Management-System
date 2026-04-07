jest.mock('nanoid', () => ({
  nanoid: () => 'test-invite-token',
}));

import { AuthService } from './auth.service';

describe('AuthService local OTP flow', () => {
  const createUserService = () => ({
    findOneBy: jest.fn(),
    saveOtp: jest.fn(),
    validateOtp: jest.fn(),
  });

  const createJwtService = () => ({
    sign: jest.fn(() => 'signed-token'),
  });

  const createMailService = () => ({
    isMailEnabled: jest.fn(),
    sendOtpEmail: jest.fn(),
  });

  it('returns a local OTP when email delivery is disabled', async () => {
    const userService = createUserService();
    const jwtService = createJwtService();
    const mailService = createMailService();
    userService.findOneBy.mockResolvedValue({
      id: 'user-1',
      email: 'local@example.com',
      isConfirmed: true,
      role: 'COMPLIANCE',
    });
    mailService.isMailEnabled.mockReturnValue(false);

    const service = new AuthService(
      userService as any,
      jwtService as any,
      mailService as any,
    );

    const result = await service.login({ email: 'local@example.com' });

    expect(result.delivery).toBe('local');
    expect(result.otpCode).toMatch(/^\d{6}$/);
    expect(result.warning).toContain('disabled');
    expect(userService.saveOtp).toHaveBeenCalledTimes(1);
    expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
  });

  it('falls back to a local OTP when email sending fails', async () => {
    const userService = createUserService();
    const jwtService = createJwtService();
    const mailService = createMailService();
    userService.findOneBy.mockResolvedValue({
      id: 'user-2',
      email: 'fallback@example.com',
      isConfirmed: true,
      role: 'COMPLIANCE',
    });
    mailService.isMailEnabled.mockReturnValue(true);
    mailService.sendOtpEmail.mockRejectedValue(new Error('SMTP unavailable'));

    const service = new AuthService(
      userService as any,
      jwtService as any,
      mailService as any,
    );

    const result = await service.login({ email: 'fallback@example.com' });

    expect(result.delivery).toBe('local');
    expect(result.otpCode).toMatch(/^\d{6}$/);
    expect(result.warning).toBe('SMTP unavailable');
    expect(mailService.sendOtpEmail).toHaveBeenCalledTimes(1);
  });
});
