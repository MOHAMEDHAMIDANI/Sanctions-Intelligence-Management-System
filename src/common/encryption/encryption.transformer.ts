import { ValueTransformer } from 'typeorm';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * TypeORM ValueTransformer for encrypting text columns.
 * Requires the EncryptionService to be injected manually or accessed via a singleton,
 * because TypeORM transformers don't natively support NestJS DI.
 */
export class EncryptionTransformer implements ValueTransformer {
  private readonly logger = new Logger(EncryptionTransformer.name);
  private encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
  }

  to(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.encryptionService.encrypt(String(value));
  }

  from(value: string | null): string | null {
    if (!value) {
      return value;
    }
    try {
      return this.encryptionService.decrypt(value);
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Failed to decrypt encrypted column value: ${error.message}`);
      throw error;
    }
  }
}
