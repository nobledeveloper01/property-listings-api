import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentsController } from './controllers/agents.controller.js';
import { Agent } from './entities/agent.entity.js';
import { AgentsRepository } from './repositories/agents.repository.js';
import { AgentsService } from './services/agents.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsRepository],
  // Listings needs to check an agent exists before accepting a listing.
  exports: [AgentsRepository],
})
export class AgentsModule {}
