export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? null;
    this.details = options.details ?? null;
    this.response = options.response ?? null;
  }
}
