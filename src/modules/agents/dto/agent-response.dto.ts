import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Agent } from '../entities/agent.entity.js';

/**
 * What an agent looks like on the way out.
 *
 * A separate class from the entity so a column added later is not published by
 * accident. Everything here is meant to be seen by whoever is looking at a
 * listing, because being contactable is the point of the record.
 */
export class AgentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Chinedu Okafor' })
  name!: string;

  @ApiProperty({ example: '+2348031234567' })
  phone!: string;

  @ApiProperty({ example: 'chinedu@lagosrealty.ng' })
  email!: string;

  @ApiPropertyOptional({ example: 'Lagos Realty', nullable: true, type: String })
  agencyName!: string | null;

  static from(agent: Agent): AgentResponseDto {
    return {
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      agencyName: agent.agencyName,
    };
  }
}

/**
 * The trimmed version that rides along on a listing.
 *
 * A listing shows who to call, not the agent's whole record, so the email
 * stays out. It is one field, but a search returning 100 listings would
 * otherwise hand 100 email addresses to anybody who asked.
 */
export class ListingAgentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Chinedu Okafor' })
  name!: string;

  @ApiProperty({ example: '+2348031234567' })
  phone!: string;

  @ApiPropertyOptional({ example: 'Lagos Realty', nullable: true, type: String })
  agencyName!: string | null;

  static from(agent: Agent): ListingAgentDto {
    return { id: agent.id, name: agent.name, phone: agent.phone, agencyName: agent.agencyName };
  }
}
