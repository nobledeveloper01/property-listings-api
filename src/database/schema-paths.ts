import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the entities and migrations live, for whoever is asking.
 *
 * Two callers need these: the TypeORM CLI's DataSource, and the TypeOrmModule
 * the application boots with. They are defined once here because the failure
 * when they drift is silent — a module with no `migrations` configured runs
 * `runMigrations()` and cheerfully applies nothing, which looks like success
 * until it meets an empty database.
 *
 * Resolved from this file rather than the working directory, and with this
 * file's own extension, so the same code serves both runs: tsx and vitest load
 * the .ts sources, the built image loads the .js beside it in dist.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ext = extname(fileURLToPath(import.meta.url));

export const ENTITIES_GLOB = join(here, '..', 'modules', '**', 'entities', `*.entity${ext}`);
export const MIGRATIONS_GLOB = join(here, 'migrations', `*${ext}`);
