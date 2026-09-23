import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateAgentDto } from '../dto/create-agent.dto.js';
import { Agent } from '../entities/agent.entity.js';

/** The only place that talks to the agents table. */
@Injectable()
export class AgentsRepository {
  constructor(@InjectRepository(Agent) private readonly agents: Repository<Agent>) {}

  create(dto: CreateAgentDto): Promise<Agent> {
    return this.agents.save(
      this.agents.create({
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        // Absent and empty both mean independent, and the column stores null
        // for that rather than an empty string.
        agencyName: dto.agencyName ?? null,
      }),
    );
  }

  findById(id: string): Promise<Agent | null> {
    return this.agents.findOne({ where: { id } });
  }
}
