import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { EntityTypeEnum } from '../../common/enums/entity-type.enum';
import { ListTypeEnum } from '../../common/enums/list-type.enum';
import { RiskEnum } from '../../common/enums/risk.enum';
import { QualityEnum } from '../../common/enums/quality.enum';
import { SanctionedEntity } from '../../sanctioned-entity/entities/sanctioned-entity.entity';
import { EntityName } from '../../entity-name/entities/entity-name.entity';
import { EntityAddress } from '../../entity-address/entities/entity-address.entity';
import { EntityDateOfBirth } from '../../entity-date-of-birth/entities/entity-date-of-birth.entity';
import { EntityStatus } from '../../entity-status/entities/entity-status.entity';
import { EntityBankAccount } from '../../entity-bank-account/entities/entity-bank-account.entity';
import { IndividualProfile } from '../../individual-profile/entities/individual-profile.entity';
import { OrganizationProfile } from '../../organization-profile/entities/organization-profile.entity';
import { VesselProfile } from '../../vessel-profile/entities/vessel-profile.entity';
import { getEncryptionTransformer } from '../../common/encryption/encryption.singleton';
import { EvidenceDocument } from '../../evidence-document/entities/evidence-document.entity';

const encryptionTransformer = getEncryptionTransformer();

@Entity('entity_profiles')
export class EntityProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_entity_profiles_sanctionedEntityId')
  @Column({ type: 'uuid' })
  sanctionedEntityId: string;

  /** Many profiles belong to one sanctioned entity (batch) */
  @ManyToOne(() => SanctionedEntity, (se) => se.entityProfiles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sanctionedEntityId' })
  sanctionedEntity: SanctionedEntity;

  @Column({
    type: 'enum',
    enum: EntityTypeEnum,
  })
  entityType: EntityTypeEnum;

  // --- Person-level fields (moved from SanctionedEntity) ---

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  fullName?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  alias?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  dateOfBirth?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  nationality?: string | null;

  @Column({ type: 'int', nullable: true })
  groupId?: number | null;

  @Column({ type: 'text', nullable: true })
  listedOn?: string | null;

  @Column({ type: 'text', nullable: true })
  otherInformation?: string | null;

  /** Raw entry data from Excel/manual form — preserves exact column values */
  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: ListTypeEnum,
    nullable: true,
  })
  listType?: ListTypeEnum | null;

  @Column({
    type: 'enum',
    enum: RiskEnum,
    nullable: true,
  })
  risk?: RiskEnum | null;

  @Column({
    type: 'enum',
    enum: QualityEnum,
    nullable: true,
  })
  quality?: QualityEnum | null;

  // --- Child relations ---

  @OneToMany(() => EntityName, (entityName) => entityName.entityProfile)
  names: EntityName[];

  @OneToMany(
    () => EntityAddress,
    (entityAddress) => entityAddress.entityProfile,
  )
  addresses: EntityAddress[];

  @OneToMany(() => EntityDateOfBirth, (entityDob) => entityDob.entityProfile)
  datesOfBirth: EntityDateOfBirth[];

  @OneToMany(() => EntityStatus, (entityStatus) => entityStatus.entityProfile)
  statuses: EntityStatus[];

  @OneToMany(
    () => EntityBankAccount,
    (entityBankAccount) => entityBankAccount.entityProfile,
  )
  bankAccounts: EntityBankAccount[];

  @OneToOne(
    () => IndividualProfile,
    (individualProfile) => individualProfile.entityProfile,
  )
  individualProfile?: IndividualProfile;

  @OneToOne(
    () => OrganizationProfile,
    (organizationProfile) => organizationProfile.entityProfile,
  )
  organizationProfile?: OrganizationProfile;

  @OneToOne(() => VesselProfile, (vesselProfile) => vesselProfile.entityProfile)
  vesselProfile?: VesselProfile;

  @OneToMany(() => EvidenceDocument, (doc) => doc.entityProfile)
  evidenceDocuments: EvidenceDocument[];

  @Column({ type: 'jsonb', nullable: true })
  errors?: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
