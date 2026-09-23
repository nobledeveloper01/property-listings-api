import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ListingsController } from './controllers/listings.controller.js';
import { Listing } from './entities/listing.entity.js';
import { ListingsRepository } from './repositories/listings.repository.js';
import { ListingsService } from './services/listings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsRepository],
})
export class ListingsModule {}
