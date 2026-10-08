export type DomainErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "STATE_CONFLICT"
  | "INVALID_ACTION"
  | "FORBIDDEN";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status?: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status =
      status ??
      (code === "STATE_CONFLICT"
        ? 409
        : code === "UNAUTHORIZED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : 400);
  }
}
