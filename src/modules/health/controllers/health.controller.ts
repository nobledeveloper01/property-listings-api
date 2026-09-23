import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * Liveness that actually checks something.
 *
 * A health endpoint that returns 200 unconditionally tells an orchestrator
 * the process is up while every request is failing on a dead connection
 * pool, so this touches the database.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness, including a database round trip.' })
  @ApiOkResponse()
  @ApiServiceUnavailableResponse()
  async check() {
    await this.dataSource.query('SELECT 1');

    return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
  }
}
