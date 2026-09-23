import { Type, plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * The environment, as the application requires it to be.
 *
 * Validated once at boot rather than read ad hoc with `process.env.X ?? fallback`
 * scattered through the code. A missing DATABASE_URL should stop the process
 * immediately with a readable message, not surface twenty minutes later as a
 * connection error in a request handler.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // Explicit @Type rather than relying on enableImplicitConversion: every
  // value out of process.env is a string, and implicit conversion depends on
  // emitted decorator metadata that is easy to lose to a build setting.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  /**
   * Only required when NODE_ENV is test, which is why it is optional here and
   * fetched with getOrThrow at the point of use — a missing value then fails
   * loudly at boot rather than silently falling back to DATABASE_URL.
   */
  @IsString()
  @IsOptional()
  TEST_DATABASE_URL?: string;

  /** Requests per minute, per IP. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT = 100;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    excludeExtraneousValues: false,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detail = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment:\n  ${detail}`);
  }

  return parsed;
}
