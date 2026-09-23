import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AgentResponseDto } from '../dto/agent-response.dto.js';
import { CreateAgentDto } from '../dto/create-agent.dto.js';
import { AgentsService } from '../services/agents.service.js';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Register an agent.',
    description: 'Every listing belongs to one of these. Create an agent first, then use its id as agentId.',
  })
  @ApiCreatedResponse({ type: AgentResponseDto })
  @ApiConflictResponse({ description: 'That phone number or email is already registered.' })
  create(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    return this.agents.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch an agent.' })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiNotFoundResponse()
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<AgentResponseDto> {
    return this.agents.findById(id);
  }
}
