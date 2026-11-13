import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryUuidV7Column } from '../../../db/primary-uuid-v7';
import { User } from '../../users/entities/user.entity';

export type AuthProvider = 'local' | 'google';

@Entity('user_identities')
@Index('user_identities_provider_uq', ['provider', 'providerUserId'], { unique: true })
export class UserIdentity {
  @PrimaryUuidV7Column()
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 32 })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255 })
  providerUserId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
