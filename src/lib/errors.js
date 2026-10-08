// Small error type shared by the API layer and validation. Pure: no runtime deps.

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const notFound = (message = 'Not found') => new ApiError(404, message);
export const methodNotAllowed = (message = 'Method not allowed') => new ApiError(405, message);
