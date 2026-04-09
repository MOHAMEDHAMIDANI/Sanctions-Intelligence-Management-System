import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { EncryptionTransformer } from './encryption.transformer';

let encryptionService: EncryptionService | null = null;
let encryptionTransformer: EncryptionTransformer | null = null;

// TypeORM transformers do not support NestJS DI, so we use a singleton.
export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    encryptionService = new EncryptionService(new ConfigService());
  }
  return encryptionService;
}

export function getEncryptionTransformer(): EncryptionTransformer {
  if (!encryptionTransformer) {
    encryptionTransformer = new EncryptionTransformer(getEncryptionService());
  }
  return encryptionTransformer;
}
