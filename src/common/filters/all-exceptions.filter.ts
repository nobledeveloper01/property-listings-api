import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * One error shape for the whole API.
 *
 * Without this, a validation failure, a 404 from a service and an unhandled
 * database error all reach the client looking different, and every consumer
 * writes three parsers. The filter also draws the line about what leaves the
 * process: anything that is not an HttpException is logged in full and
 * reported as a bare 500, because an unhandled error's message is as likely
 * to contain a connection string as anything useful to a caller.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttp) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      // ValidationPipe puts an array of messages here; a plain HttpException a
      // string. Both are passed through unchanged so a client can show either.
      ...this.describe(exception, isHttp),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown, isHttp: boolean): { error: string; message: string | string[] } {
    if (!isHttp) {
      return { error: 'Internal Server Error', message: 'Something went wrong on our side.' };
    }

    const body = (exception as HttpException).getResponse();

    if (typeof body === 'string') {
      return { error: (exception as HttpException).name, message: body };
    }

    const { error, message } = body as { error?: string; message?: string | string[] };

    return {
      error: error ?? (exception as HttpException).name,
      message: message ?? 'Request failed.',
    };
  }
}
