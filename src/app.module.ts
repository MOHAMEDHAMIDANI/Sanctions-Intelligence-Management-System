import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import * as Joi from 'joi';

import { EncryptionModule } from './common/encryption/encryption.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RequisitionModule } from './requisition/requisition.module';
import { SanctionedEntityModule } from './sanctioned-entity/sanctioned-entity.module';
import { EntityNameModule } from './entity-name/entity-name.module';
import { EntityDateOfBirthModule } from './entity-date-of-birth/entity-date-of-birth.module';
import { EntityAddressModule } from './entity-address/entity-address.module';
import { EntityStatusModule } from './entity-status/entity-status.module';
import { EntityProfileModule } from './entity-profile/entity-profile.module';
import { IndividualProfileModule } from './individual-profile/individual-profile.module';
import { OrganizationProfileModule } from './organization-profile/organization-profile.module';
import { VesselProfileModule } from './vessel-profile/vessel-profile.module';
import { EntityBankAccountModule } from './entity-bank-account/entity-bank-account.module';
import { EvidenceDocumentModule } from './evidence-document/evidence-document.module';
import { ExportJobModule } from './export-job/export-job.module';
import { ExportRowModule } from './export-row/export-row.module';
import { ExternalSourceModule } from './external-source/external-source.module';
import { SyncRunModule } from './sync-run/sync-run.module';
import { SyncedEntityModule } from './synced-entity/synced-entity.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AggregateSnapshotModule } from './aggregate-snapshot/aggregate-snapshot.module';
import { DatabaseModule } from './database/database.module';
import { ReviewModule } from './review/review.module';
import { NotificationModule } from './notification/notification.module';
import { WebhookModule } from './webhook/webhook.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        FRONTEND_URL: Joi.string().required(),
        BACKEND_URL: Joi.string().optional(),
        SUPER_ADMIN_EMAIL: Joi.string().email().optional(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        ELASTICSEARCH_NODE: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRATION: Joi.string().required(),
        ENCRYPTION_KEYS: Joi.string().required(),
        MAIL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
        SMTP_HOST: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().allow('', null).optional(),
        }),
        SMTP_PORT: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.number().required(),
          otherwise: Joi.number().optional(),
        }),
        SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
        SMTP_USER: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().allow('', null).optional(),
        }),
        SMTP_PASSWORD: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().allow('', null).optional(),
        }),
        MAIL_FROM: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().allow('', null).optional(),
        }),
        INVITE_URL_TEMPLATE: Joi.string().optional(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE'),
      }),
      inject: [ConfigService],
    }),
    EncryptionModule,
    AuthModule,
    UserModule,
    RequisitionModule,
    SanctionedEntityModule,
    EntityNameModule,
    EntityDateOfBirthModule,
    EntityAddressModule,
    EntityStatusModule,
    EntityProfileModule,
    IndividualProfileModule,
    OrganizationProfileModule,
    VesselProfileModule,
    EntityBankAccountModule,
    EvidenceDocumentModule,
    ExportJobModule,
    ExportRowModule,
    ExternalSourceModule,
    SyncRunModule,
    SyncedEntityModule,
    AuditLogModule,
    AggregateSnapshotModule,
    DatabaseModule,
    ReviewModule,
    NotificationModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
