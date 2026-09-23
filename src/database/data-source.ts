import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * The DataSource the TypeORM CLI uses for migrations.
 *
 * Separate from the Nest module because the CLI runs outside the application
 * context and cannot ask Nest's config service for anything. Both read the
 * same DATABASE_URL, so they cannot drift.
 */
loadEnv();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  // Never true. Migrations are the only thing that changes the schema, so the
  // schema in production is always something somebody reviewed.
  synchronize: false,
});
