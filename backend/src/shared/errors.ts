export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_REUSED'
  | 'EMAIL_TAKEN'
  | 'ACCOUNT_NOT_FOUND'
  | 'RECIPIENT_NOT_FOUND'
  | 'SELF_TRANSFER'
  | 'INSUFFICIENT_FUNDS'
  | 'BALANCE_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

// An error that is safe to show to API clients. Anything else becomes a generic 500. /
// this should refer us back to the first stage of inteview where i was asked by the cto on how handle errors accross endpoints that fails
//so we can ,make it glibal or centralise pur error
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: ErrorCode, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (code: ErrorCode, message: string) => new AppError(401, code, message);
export const notFound = (code: ErrorCode, message: string) => new AppError(404, code, message);
export const conflict = (code: ErrorCode, message: string) => new AppError(409, code, message);
export const unprocessable = (code: ErrorCode, message: string) => new AppError(422, code, message);
