import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives `listings.agent_id` something to point at.
 *
 * Until now that column was a UUID with no table behind it, so a listing could
 * name an agent who had never been registered and nothing could detect it.
 * This adds the table, then the foreign key.
 *
 * Existing rows matter: the constraint cannot be added while any listing
 * references a missing agent, so the agents named by current listings are
 * inserted first, as placeholders that carry their own id. On a seeded
 * development database that keeps the data usable; on an empty one it inserts
 * nothing.
 */
export class CreateAgents1758646000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE agents (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         varchar(120) NOT NULL,
        phone        varchar(20)  NOT NULL,
        email        varchar(255) NOT NULL,
        agency_name  varchar(160),
        created_at   timestamptz  NOT NULL DEFAULT now(),
        updated_at   timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT chk_agents_name_present  CHECK (length(btrim(name)) > 0),
        CONSTRAINT chk_agents_email_shape   CHECK (email LIKE '%_@_%.__%')
      )
    `);

    // Unique, because a phone number is how this industry identifies an agent
    // and an email is how the system will. Both are indexes rather than table
    // constraints so the service can name the one that rejected a row.
    await queryRunner.query(`CREATE UNIQUE INDEX idx_agents_phone ON agents (phone)`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_agents_email ON agents (email)`);

    // Placeholders for agents that listings already reference. Deliberately
    // obvious: anybody reading one of these rows should see it needs real
    // details.
    //
    // The distinct ids are collected in a subquery before the row number is
    // assigned. A window function is evaluated before DISTINCT, so numbering
    // in the outer query gives every listing its own number and DISTINCT can
    // no longer collapse the duplicates, which fails on the primary key.
    await queryRunner.query(`
      INSERT INTO agents (id, name, phone, email)
      SELECT
        missing.agent_id,
        'Unknown agent ' || left(missing.agent_id::text, 8),
        '+234000' || lpad((row_number() OVER (ORDER BY missing.agent_id))::text, 7, '0'),
        'unknown+' || left(missing.agent_id::text, 8) || '@placeholder.invalid'
      FROM (
        SELECT DISTINCT l.agent_id
        FROM listings l
        WHERE NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = l.agent_id)
      ) AS missing
    `);

    // Not every listing has an agent. An owner advertising their own place
    // directly is ordinary here, and should not have to invent one. A foreign
    // key still applies to the rows that do name an agent, because SQL only
    // checks the constraint when the column is not null.
    await queryRunner.query(`ALTER TABLE listings ALTER COLUMN agent_id DROP NOT NULL`);

    // RESTRICT, not CASCADE: deleting an agent who still holds listings should
    // fail loudly rather than quietly taking their whole portfolio with them.
    await queryRunner.query(`
      ALTER TABLE listings
        ADD CONSTRAINT fk_listings_agent
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listings DROP CONSTRAINT fk_listings_agent`);
    // Only safe because nothing could have written a null while the column was
    // constrained; a revert on a database that has since taken agentless
    // listings would have to decide what to do with them first.
    await queryRunner.query(`ALTER TABLE listings ALTER COLUMN agent_id SET NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_email`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_phone`);
    await queryRunner.query(`DROP TABLE agents`);
  }
}
