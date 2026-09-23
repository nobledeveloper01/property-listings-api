import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { MIGRATIONS_GLOB } from './database/schema-paths.js';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';
import { AgentsModule } from './modules/agents/agents.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        // Under test, the test database, and structurally so.
        //
        // The integration suite truncates between cases, so pointing it at
        // the development database destroys whatever you were looking at.
        // Overriding process.env from the spec did not work — ConfigModule
        // lets the .env file win — and a README note is not a guarantee.
        // Choosing the URL here means a test run cannot reach the
        // development database even by accident.
        url:
          config.get<string>('NODE_ENV') === 'test'
            ? config.getOrThrow<string>('TEST_DATABASE_URL')
            : config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Without this the module has no migrations to run, so a test suite
        // that calls runMigrations() against a fresh database applies nothing
        // and then fails on the first query. It passed locally only because
        // that database had been migrated by hand once.
        migrations: [MIGRATIONS_GLOB],
        // Migrations own the schema. `synchronize` would quietly rewrite
        // production tables on deploy, and it cannot create the GiST index
        // this service depends on anyway.
        synchronize: false,
      }),
    }),

    // Rate limiting, applied globally below. A property search is cheap to
    // call and expensive to serve, which is exactly the shape of endpoint
    // that gets scraped.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: config.get<number>('THROTTLE_LIMIT', 100) },
      ],
    }),

    AgentsModule,
    ListingsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, including ones that never reach a controller.
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
