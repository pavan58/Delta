/** Errors with an HTTP status and an Azure-style error code. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
export const notFound = (msg: string) => new AppError(404, "ResourceNotFound", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const forbidden = (code: string, msg: string) => new AppError(403, code, msg);
export const unauthorized = () => new AppError(401, "Unauthorized", "Sign in required.");
