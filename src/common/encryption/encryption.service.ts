import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keys: Buffer[];
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private configService: ConfigService) {
    const keysString = this.configService.get<string>('ENCRYPTION_KEYS');
    if (!keysString) {
      throw new Error('ENCRYPTION_KEYS is required for encrypted fields');
    }

    this.keys = keysString.split(',').map((k) => Buffer.from(k.trim(), 'utf8'));
    if (this.keys.length === 0 || this.keys[0].length !== 32) {
      this.logger.error('Invalid ENCRYPTION_KEYS configuration');
      throw new Error(
        'Invalid ENCRYPTION_KEYS. Must be comma separated string of 32-byte keys.',
      );
    }
  }

  // Gets the active key (the first one)
  private get activeKey(): Buffer {
    return this.keys[0];
  }

  /**
   * Encrypts text using the active key.
   * Format: version:iv:ciphertext (where version is the index of the key used, usually 0)
   */
  encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.activeKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 0 represents the index of the active key
    return `0:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts text. Attempts to read the key version from the string.
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText; // Not our format

    const keyVersion = parseInt(parts[0], 10);
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedTextContent = parts[2];

    const key = this.keys[keyVersion];
    if (!key) {
      throw new Error(`Encryption key version ${keyVersion} not found`);
    }

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    let decrypted = decipher.update(encryptedTextContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
