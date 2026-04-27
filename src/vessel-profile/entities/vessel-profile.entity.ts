import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityProfile } from '../../entity-profile/entities/entity-profile.entity';

@Entity('vessel_profiles')
export class VesselProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entityProfileId: string;

  @OneToOne(
    () => EntityProfile,
    (entityProfile) => entityProfile.vesselProfile,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'entityProfileId' })
  entityProfile: EntityProfile;

  @Column({ type: 'text', nullable: true })
  imoNumber?: string | null;

  @Column({ type: 'text', nullable: true })
  mmsi?: string | null;

  @Column({ type: 'text', nullable: true })
  vesselType?: string | null;

  @Column({ type: 'text', nullable: true })
  flag?: string | null;

  @Column({ type: 'text', nullable: true })
  callSign?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
