export const DomainErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT_STATE: 'CONFLICT_STATE',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export const DOMAIN_ERROR_STATUS_MAP: Record<DomainErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_STATE: 409,
  INSUFFICIENT_FUNDS: 402,
  INTERNAL_ERROR: 500,
} as const;

export interface DomainErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown> | undefined;
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    httpStatus: number = DOMAIN_ERROR_STATUS_MAP[code],
    options?: DomainErrorOptions
  ) {
    super(message, { cause: options?.cause });
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
