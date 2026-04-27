jest.mock('nanoid', () => ({
  nanoid: () => 'test-invite-token',
}));

import { UserService } from './user.service';

describe('UserService local invitation flow', () => {
  const createRepository = () => ({
    findOneBy: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: value.id || 'user-1',
      ...value,
    })),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  });

  const createMailService = () => ({
    isMailEnabled: jest.fn(),
    getInviteUrl: jest.fn(
      (token: string) => `http://localhost:5173/confirm-account?token=${token}`,
    ),
    sendInviteEmail: jest.fn(),
  });

  it('creates a user and returns a local invite link when email is disabled', async () => {
    const repository = createRepository();
    const mailService = createMailService();
    mailService.isMailEnabled.mockReturnValue(false);
    repository.findOneBy.mockResolvedValue(null);

    const service = new UserService(repository as any, mailService as any);

    const result = await service.create({
      firstName: 'Local',
      lastName: 'User',
      email: 'local@example.com',
      role: 'COMPLIANCE' as any,
    });

    expect(result.email).toBe('local@example.com');
    expect(result.invitationDelivery).toBe('local');
    expect(result.inviteUrl).toContain('confirm-account?token=');
    expect(result.invitationWarning).toContain('disabled');
    expect(mailService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('returns an invite link for an existing unconfirmed user', async () => {
    const repository = createRepository();
    const mailService = createMailService();
    const expiry = new Date(Date.now() + 3600_000);
    repository.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'pending@example.com',
      isConfirmed: false,
      inviteToken: 'pending-token',
      inviteTokenExpiry: expiry,
    });

    const service = new UserService(repository as any, mailService as any);

    const result = await service.getInviteLink('user-2');

    expect(result.email).toBe('pending@example.com');
    expect(result.inviteUrl).toContain('pending-token');
    expect(result.inviteTokenExpiry).toBe(expiry);
  });
});
