import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

/**
 * The filter is the only thing every client sees on every failure, so the
 * shape it publishes is part of the contract.
 */
describe('AllExceptionsFilter', () => {
  const capture = (exception: unknown) => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', url: '/listings' }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(exception, host);

    return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
  };

  it('reports the HTTP status text rather than the exception class name', () => {
    // ThrottlerException is the one that made this worth asserting: its class
    // name reached callers as `"error": "ThrottlerException"`, and its message
    // carried the same name again as a prefix.
    const { status, body } = capture(new ThrottlerException());

    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(body.error).toBe('Too Many Requests');
    expect(body.message).toBe('Too Many Requests');
    expect(JSON.stringify(body)).not.toContain('ThrottlerException');
  });

  it('uses one envelope for every failure', () => {
    const keys = ['error', 'message', 'path', 'statusCode', 'timestamp'];

    for (const exception of [
      new NotFoundException('No listing with that id.'),
      new BadRequestException(['type must be one of the following values']),
      new ThrottlerException(),
      new Error('something unhandled'),
    ]) {
      expect(Object.keys(capture(exception).body).sort()).toEqual(keys);
    }
  });

  it('keeps an unhandled error off the wire', () => {
    const { status, body } = capture(new Error('connect ECONNREFUSED postgres://user:hunter2@db:5432'));

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Something went wrong on our side.');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('passes a validation pipe\'s array of messages through unchanged', () => {
    const { body } = capture(new BadRequestException(['bedrooms must not be less than 0', 'type must be one of']));

    expect(body.message).toEqual(['bedrooms must not be less than 0', 'type must be one of']);
  });

  it('does not strip a message that merely starts with a similar word', () => {
    const { body } = capture(new HttpException('Error budget exhausted', HttpStatus.SERVICE_UNAVAILABLE));

    expect(body.error).toBe('Service Unavailable');
    expect(body.message).toBe('Error budget exhausted');
  });
});
