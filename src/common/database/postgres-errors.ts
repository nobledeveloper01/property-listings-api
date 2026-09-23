/**
 * Reading Postgres errors without parsing English.
 *
 * The driver puts the SQLSTATE code and the constraint name on the error, so
 * a caller can tell "this email is taken" from "this phone is taken" from
 * "something else failed" without matching on a message string that changes
 * between Postgres versions.
 *
 * TypeORM wraps the driver error, and depending on the call it may hand back
 * either the wrapper or the original, so both shapes are checked here rather
 * than at four call sites.
 */

/** unique_violation: a unique index rejected the row. */
export const UNIQUE_VIOLATION = '23505';

/** foreign_key_violation: the row points at something that does not exist. */
export const FOREIGN_KEY_VIOLATION = '23503';

interface PostgresErrorShape {
  code?: string;
  constraint?: string;
  driverError?: { code?: string; constraint?: string };
}

const unwrap = (error: unknown): PostgresErrorShape => {
  const candidate = error as PostgresErrorShape | undefined;

  return candidate?.driverError ?? candidate ?? {};
};

/** The SQLSTATE code, or undefined if this was not a database error at all. */
export const codeOf = (error: unknown): string | undefined => unwrap(error).code;

/** The index or constraint that rejected the row, by name. */
export const constraintOf = (error: unknown): string | undefined => unwrap(error).constraint;

/** True when this error is that exact constraint failing, and nothing else. */
export const violates = (error: unknown, code: string, constraint: string): boolean =>
  codeOf(error) === code && constraintOf(error) === constraint;
