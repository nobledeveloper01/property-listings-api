import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * The estate agent who is marketing a property.
 *
 * This exists because `listings.agent_id` previously pointed at nothing. Any
 * UUID at all was accepted, so a listing could belong to an agent who had
 * never existed, and nothing in the system could tell. Worse, a buyer who
 * liked a flat got back a bare UUID and no way to ring anybody about it.
 *
 * An agent is a person or a firm. Both are common here: plenty of Nigerian
 * agents work independently and plenty work under an agency, so `agencyName`
 * is optional rather than a separate table.
 *
 * Deliberately one-directional: this entity does not hold a `listings` array.
 * Listing already points here, and adding the inverse side made the two files
 * import each other. Under ESM that cycle is fatal, because the decorator
 * metadata for the relation is read while the other module is still being
 * evaluated, and the app dies on startup with "Cannot access 'Agent' before
 * initialization". Nothing needs the inverse, so the cheapest fix is not to
 * have it.
 */
@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /**
   * Unique, because the phone number is how this industry actually identifies
   * an agent. Two records for one number means two people answering for the
   * same listings, and a duplicate is far more likely to be a re-registration
   * than a genuinely new agent.
   */
  @Index('idx_agents_phone', { unique: true })
  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Index('idx_agents_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /** Null for an independent agent, which is a normal state and not missing data. */
  @Column({ type: 'varchar', length: 160, name: 'agency_name', nullable: true })
  agencyName!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
