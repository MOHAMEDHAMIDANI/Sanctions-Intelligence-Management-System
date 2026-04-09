import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GenderEnum } from '../../common/enums/gender.enum';
import { EntityProfile } from '../../entity-profile/entities/entity-profile.entity';
import { getEncryptionTransformer } from '../../common/encryption/encryption.singleton';

const encryptionTransformer = getEncryptionTransformer();

@Entity('individual_profiles')
export class IndividualProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_individual_profiles_entityProfileId', { unique: true })
  @Column({ type: 'uuid' })
  entityProfileId: string;

  @OneToOne(() => EntityProfile, (entityProfile) => entityProfile.individualProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityProfileId' })
  entityProfile: EntityProfile;

  @Column({
    type: 'enum',
    enum: GenderEnum,
    nullable: true,
  })
  gender?: GenderEnum | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  nationality?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  placeOfBirth?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  passportNumber?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  passportDetails?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  nationalIdNumber?: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  nationalIdDetails?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
