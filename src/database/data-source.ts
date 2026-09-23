// A side-effect import, not an unused one: TypeORM's decorators read the
// metadata this installs, and the CLI has no Nest bootstrap to do it first.
// oxlint-disable-next-line no-unassigned-import
import 'reflect-metadata';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Resolved from this file rather than the working directory, and with this
// file's own extension, so one data source serves both runs: tsx loads the
// .ts sources, the built image loads the .js beside it in dist. Hardcoding
// src/**/*.ts would leave the production image with no migrations to run and
// no obvious reason why.
const here = dirname(fileURLToPath(import.meta.url));
const ext = extname(fileURLToPath(import.meta.url));

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(here, '..', 'modules', '**', 'entities', `*.entity${ext}`)],
  migrations: [join(here, 'migrations', `*${ext}`)],
  // Never true. Migrations are the only thing that changes the schema, so the
  // schema in production is always something somebody reviewed.
  synchronize: false,
});
