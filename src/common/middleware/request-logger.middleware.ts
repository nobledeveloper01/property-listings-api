import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** The header a client or an upstream proxy may already have set. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Gives every request an id and logs how it ended.
 *
 * Middleware rather than an interceptor on purpose. An interceptor runs
 * inside Nest's request pipeline, so anything rejected before it — a
 * throttled request, a payload over the body limit — never reaches it and
 * never gets logged. Middleware sits in front of all of that, which is
 * exactly where you want the record of a request that was refused.
 *
 * An inbound `x-request-id` is honoured rather than overwritten, so a trace
 * started at the gateway survives into this service's logs.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = (request.headers[REQUEST_ID_HEADER] as string) ?? randomUUID();
    const startedAt = process.hrtime.bigint();

    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    // 'finish' rather than wrapping res.send: it fires once, after the status
    // is known, whatever produced the response — including a filter.
    response.once('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = `${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs.toFixed(1)}ms ${requestId}`;

      // Server faults are errors, client mistakes are warnings, and the rest
      // is routine. A log where everything is one level is a log nobody reads.
      if (response.statusCode >= 500) {
        this.logger.error(line);
      } else if (response.statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
