import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { MailService } from '../common/mail/mail.service';
import { addMinutes } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userService.findOneBy({ email: loginDto.email });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isConfirmed) {
      throw new UnauthorizedException('Account not confirmed. Please check your email.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = addMinutes(new Date(), 5);

    // Save OTP to user (not shown here, assumed to be in userService)
    await this.userService.saveOtp(user.id, otp, expiry);

    // Send OTP via email
    await this.mailService.sendOtpEmail(user.email, otp);

    return { message: 'OTP sent to your email' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, code } = verifyOtpDto;
    const user = await this.userService.findOneBy({ email });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify OTP (assuming saveOtp/validateOtp in userService)
    const isValid = await this.userService.validateOtp(user.id, code);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async resendOtp(email: string) {
    return this.login({ email });
  }

  async confirmAccount(token: string) {
    return this.userService.confirmAccount(token);
  }
}
