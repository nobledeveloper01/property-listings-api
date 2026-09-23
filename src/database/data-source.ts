// A side-effect import, not an unused one: TypeORM's decorators read the
// metadata this installs, and the CLI has no Nest bootstrap to do it first.
// oxlint-disable-next-line no-unassigned-import
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { ENTITIES_GLOB, MIGRATIONS_GLOB } from './schema-paths.js';

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
  entities: [ENTITIES_GLOB],
  migrations: [MIGRATIONS_GLOB],
  // Never true. Migrations are the only thing that changes the schema, so the
  // schema in production is always something somebody reviewed.
  synchronize: false,
});
