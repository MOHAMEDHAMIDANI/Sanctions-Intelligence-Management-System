import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const port = Number(this.configService.get<number>('SMTP_PORT', 465));
    const secure =
      String(this.configService.get('SMTP_SECURE')).toLowerCase() === 'true' ||
      port === 465;

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port,
      secure,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass:
          this.configService.get<string>('SMTP_PASSWORD') ||
          this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  isMailEnabled() {
    return String(this.configService.get('MAIL_ENABLED', 'true')).toLowerCase() !== 'false';
  }

  private getFromAddress() {
    return (
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM')
    );
  }

  private trimTrailingSlash(url: string) {
    return url.replace(/\/+$/, '');
  }

  private buildInviteUrl(token: string) {
    const encodedToken = encodeURIComponent(token);
    const inviteUrlTemplate = this.configService.get<string>('INVITE_URL_TEMPLATE');

    if (inviteUrlTemplate) {
      return inviteUrlTemplate
        .replace('{{token}}', encodedToken)
        .replace('{token}', encodedToken);
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (frontendUrl) {
      return `${this.trimTrailingSlash(frontendUrl)}/confirm-account?token=${encodedToken}`;
    }

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('APP_URL');
    if (backendUrl) {
      return `${this.trimTrailingSlash(backendUrl)}/user/confirm/${encodedToken}`;
    }

    const fallbackBaseUrl = `http://localhost:${this.configService.get<string>('PORT', '3000')}`;
    this.logger.warn(
      `FRONTEND_URL and BACKEND_URL are not configured. Falling back to ${fallbackBaseUrl} for invite links.`,
    );
    return `${fallbackBaseUrl}/user/confirm/${encodedToken}`;
  }

  getInviteUrl(token: string) {
    return this.buildInviteUrl(token);
  }

  private assertSmtpConfig() {
    const requiredValues = {
      SMTP_HOST: this.configService.get<string>('SMTP_HOST'),
      SMTP_PORT: this.configService.get<string>('SMTP_PORT'),
      SMTP_USER: this.configService.get<string>('SMTP_USER'),
      SMTP_PASSWORD:
        this.configService.get<string>('SMTP_PASSWORD') ||
        this.configService.get<string>('SMTP_PASS'),
      MAIL_FROM: this.getFromAddress(),
    };

    const missingKeys = Object.entries(requiredValues)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length) {
      const message = `SMTP configuration is incomplete: ${missingKeys.join(', ')}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  private async sendMail(options: { to: string, subject: string, html: string, from?: string }) {
    this.assertSmtpConfig();

    try {
      const result = await this.transporter.sendMail({
        from: options.from || this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        text: options.html.replace(/<[^>]*>?/gm, ''),
        html: options.html,
      });

      this.logger.log(`Email sent successfully to ${options.to} (${result.messageId})`);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`SMTP send failed: ${err.message}`);
      throw err;
    }
  }

  async sendInviteEmail(to: string, token: string) {
    const inviteUrl = this.buildInviteUrl(token);

    await this.sendMail({
      to,
      subject: 'Account Invitation - SIMS',
      html: `
        <h1>Welcome to SIMS</h1>
        <p>You have been invited to join the Sanctions Intelligence Management System.</p>
        <p>Please click the link below to confirm your account and log in:</p>
        <a href="${inviteUrl}">${inviteUrl}</a>
        <p>If you did not expect this invitation, please ignore this email.</p>
      `,
    });
  }

  async sendOtpEmail(to: string, code: string) {
    await this.sendMail({
      to,
      subject: 'Your Login Verification Code',
      html: `
        <h1>Verification Code</h1>
        <p>Your 6-digit verification code is: <strong>${code}</strong></p>
        <p>This code will expire in 5 minutes.</p>
      `,
    });
  }
}
