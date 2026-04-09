import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../common/mail/mail.service';
import { nanoid } from 'nanoid';
import { addDays, isAfter } from 'date-fns';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.userRepository.findOneBy({ email: createUserDto.email });
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const inviteToken = nanoid(32);
    const inviteTokenExpiry = addDays(new Date(), 7);

    const user = this.userRepository.create({
      ...createUserDto,
      inviteToken,
      inviteTokenExpiry,
      isConfirmed: false,
    });

    const savedUser = await this.userRepository.save(user);
    const inviteUrl = this.mailService.getInviteUrl(inviteToken);
    let invitationDelivery: 'email' | 'local' = 'local';
    let invitationWarning: string | undefined;

    if (this.mailService.isMailEnabled()) {
      try {
        await this.mailService.sendInviteEmail(savedUser.email, inviteToken);
        invitationDelivery = 'email';
      } catch (error) {
        const err = error as Error;
        invitationWarning =
          err.message || 'Invitation email failed to send. Use the local invite link instead.';
      }
    } else {
      invitationWarning =
        'Email delivery is disabled. Use the local invite link instead.';
    }

    return {
      ...savedUser,
      inviteUrl,
      invitationDelivery,
      invitationWarning,
    };
  }

  async findAll() {
    return this.userRepository.find();
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOneBy({ id } as any);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOneBy(condition: any) {
    return this.userRepository.findOneBy(condition);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return this.userRepository.remove(user);
  }

  async saveOtp(id: string, otp: string, expiry: Date) {
    const otpCode = await bcrypt.hash(otp, 10);

    await this.userRepository.update(id, {
      otpCode,
      otpExpiry: expiry,
      otpAttemptCount: 0,
      otpLockedUntil: null,
    });
  }

  async validateOtp(id: string, otp: string) {
    const user = await this.userRepository.findOne({
      where: { id: id as any },
      select: ['id', 'otpCode', 'otpExpiry', 'otpAttemptCount', 'otpLockedUntil'],
    });

    if (!user) {
      return false;
    }

    if (user.otpLockedUntil && isAfter(user.otpLockedUntil, new Date())) {
      throw new HttpException(
        'Too many invalid OTP attempts. Try again after the lockout expires.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user.otpCode || !user.otpExpiry || isAfter(new Date(), user.otpExpiry)) {
      return false;
    }

    const isValid = await bcrypt.compare(otp, user.otpCode);

    if (!isValid) {
      const nextAttempts = (user.otpAttemptCount || 0) + 1;
      const shouldLock = nextAttempts >= 5;
      await this.userRepository.update(id, {
        otpAttemptCount: shouldLock ? 0 : nextAttempts,
        otpLockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
      });
      return false;
    }

    await this.userRepository.update(id, {
      otpCode: null,
      otpExpiry: null,
      otpAttemptCount: 0,
      otpLockedUntil: null,
    });

    return true;
  }

  async confirmAccount(token: string) {
    const user = await this.userRepository.findOne({
      where: { inviteToken: token },
      select: ['id', 'inviteToken', 'inviteTokenExpiry', 'isConfirmed'],
    });

    if (!user || isAfter(new Date(), user.inviteTokenExpiry)) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    user.isConfirmed = true;
    user.inviteToken = null;
    user.inviteTokenExpiry = null;
    await this.userRepository.save(user);

    return { message: 'Account confirmed successfully' };
  }

  async getInviteLink(id: string) {
    const user = await this.userRepository.findOne({
      where: { id } as any,
      select: [
        'id',
        'email',
        'isConfirmed',
        'inviteToken',
        'inviteTokenExpiry',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isConfirmed) {
      throw new BadRequestException('User account is already confirmed');
    }

    if (!user.inviteToken || !user.inviteTokenExpiry || isAfter(new Date(), user.inviteTokenExpiry)) {
      throw new BadRequestException('Invitation token is missing or expired');
    }

    return {
      id: user.id,
      email: user.email,
      inviteUrl: this.mailService.getInviteUrl(user.inviteToken),
      inviteTokenExpiry: user.inviteTokenExpiry,
    };
  }
}
