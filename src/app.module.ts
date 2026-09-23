import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
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

    ListingsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
