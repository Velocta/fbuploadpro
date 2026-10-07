import { describe, it, expect } from 'vitest';
import {
  DomainError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictStateError,
  InsufficientFundsError,
  InternalError,
  ERROR_HTTP_MAPPINGS,
} from '../src/index.js';

describe('Domain Error Taxonomy', () => {
  it('maps domain error codes to expected HTTP status codes', () => {
    expect(ERROR_HTTP_MAPPINGS.VALIDATION_FAILED).toBe(400);
    expect(ERROR_HTTP_MAPPINGS.UNAUTHORIZED).toBe(401);
    expect(ERROR_HTTP_MAPPINGS.FORBIDDEN).toBe(403);
    expect(ERROR_HTTP_MAPPINGS.NOT_FOUND).toBe(404);
    expect(ERROR_HTTP_MAPPINGS.CONFLICT_STATE).toBe(409);
    expect(ERROR_HTTP_MAPPINGS.INSUFFICIENT_FUNDS).toBe(402);
    expect(ERROR_HTTP_MAPPINGS.INTERNAL_ERROR).toBe(500);
  });

  it('instantiates specialized error subclasses with correct status codes and defaults', () => {
    const valErr = new ValidationError('Bad input', { field: 'email' });
    expect(valErr).toBeInstanceOf(DomainError);
    expect(valErr.code).toBe('VALIDATION_FAILED');
    expect(valErr.statusCode).toBe(400);
    expect(valErr.message).toBe('Bad input');
    expect(valErr.details).toEqual({ field: 'email' });

    const unauthErr = new UnauthorizedError();
    expect(unauthErr.code).toBe('UNAUTHORIZED');
    expect(unauthErr.statusCode).toBe(401);

    const forbErr = new ForbiddenError();
    expect(forbErr.code).toBe('FORBIDDEN');
    expect(forbErr.statusCode).toBe(403);

    const notFoundErr = new NotFoundError();
    expect(notFoundErr.code).toBe('NOT_FOUND');
    expect(notFoundErr.statusCode).toBe(404);

    const conflictErr = new ConflictStateError();
    expect(conflictErr.code).toBe('CONFLICT_STATE');
    expect(conflictErr.statusCode).toBe(409);

    const fundsErr = new InsufficientFundsError();
    expect(fundsErr.code).toBe('INSUFFICIENT_FUNDS');
    expect(fundsErr.statusCode).toBe(402);

    const internalErr = new InternalError();
    expect(internalErr.code).toBe('INTERNAL_ERROR');
    expect(internalErr.statusCode).toBe(500);
  });
});
