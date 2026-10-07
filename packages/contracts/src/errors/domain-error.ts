export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT_STATE'
  | 'INSUFFICIENT_FUNDS'
  | 'INTERNAL_ERROR';

export const ERROR_HTTP_MAPPINGS: Record<DomainErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_STATE: 409,
  INSUFFICIENT_FUNDS: 402,
  INTERNAL_ERROR: 500,
};

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = ERROR_HTTP_MAPPINGS[code] ?? 500;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'The provided input parameters are invalid.', details?: unknown) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required to access this resource.', details?: unknown) {
    super('UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.', details?: unknown) {
    super('FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'The requested resource could not be found.', details?: unknown) {
    super('NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictStateError extends DomainError {
  constructor(message = 'A resource with these attributes already exists.', details?: unknown) {
    super('CONFLICT_STATE', message, details);
    this.name = 'ConflictStateError';
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message = 'Insufficient token balance to perform this operation.', details?: unknown) {
    super('INSUFFICIENT_FUNDS', message, details);
    this.name = 'InsufficientFundsError';
  }
}

export class InternalError extends DomainError {
  constructor(message = 'An unexpected internal error occurred.', details?: unknown) {
    super('INTERNAL_ERROR', message, details);
    this.name = 'InternalError';
  }
}
