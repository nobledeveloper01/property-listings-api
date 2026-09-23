import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { UNIQUE_VIOLATION, violates } from '../../../common/database/postgres-errors.js';
import { AgentResponseDto } from '../dto/agent-response.dto.js';
import { CreateAgentDto } from '../dto/create-agent.dto.js';
import { AgentsRepository } from '../repositories/agents.repository.js';

@Injectable()
export class AgentsService {
  constructor(private readonly agents: AgentsRepository) {}

  async create(dto: CreateAgentDto): Promise<AgentResponseDto> {
    try {
      return AgentResponseDto.from(await this.agents.create(dto));
    } catch (error) {
      // Checking the constraint by name rather than parsing the message, so
      // the caller is told which field clashed instead of "duplicate key".
      if (violates(error, UNIQUE_VIOLATION, 'idx_agents_phone')) {
        throw new ConflictException('An agent is already registered with that phone number.');
      }

      if (violates(error, UNIQUE_VIOLATION, 'idx_agents_email')) {
        throw new ConflictException('An agent is already registered with that email address.');
      }

      throw error;
    }
  }

  async findById(id: string): Promise<AgentResponseDto> {
    const agent = await this.agents.findById(id);

    if (agent === null) {
      throw new NotFoundException(`No agent with id ${id}.`);
    }

    return AgentResponseDto.from(agent);
  }
}
