import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../common/mail/mail.service';
import { nanoid } from 'nanoid';
import { addDays, isAfter } from 'date-fns';

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

    try {
      await this.mailService.sendInviteEmail(savedUser.email, inviteToken);
    } catch {
      await this.userRepository.delete(savedUser.id);
      throw new InternalServerErrorException(
        'User could not be created because the invitation email failed to send',
      );
    }

    return savedUser;
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
    await this.userRepository.update(id, {
      otpCode: otp,
      otpExpiry: expiry,
    });
  }

  async validateOtp(id: string, otp: string) {
    // Need to select otpCode and otpExpiry as they are hidden by default
    const user = await this.userRepository.findOne({
      where: { id: id as any },
      select: ['id', 'otpCode', 'otpExpiry'],
    });

    if (!user || user.otpCode !== otp || isAfter(new Date(), user.otpExpiry)) {
      return false;
    }

    // Clear OTP after successful validation
    await this.userRepository.update(id, {
      otpCode: null,
      otpExpiry: null,
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
}
