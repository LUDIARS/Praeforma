// LUDIARS 標準のエラー形式。
// JSON 形は { error: string, detail?: unknown }、 status は HTTP code。

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): { error: string; detail?: unknown } {
    const json: { error: string; detail?: unknown } = { error: this.message };
    if (this.detail !== undefined) json.detail = this.detail;
    return json;
  }

  static badRequest(msg: string, detail?: unknown): AppError {
    return new AppError(msg, 400, detail);
  }
  static unauthorized(msg = 'unauthorized'): AppError {
    return new AppError(msg, 401);
  }
  static forbidden(msg = 'forbidden'): AppError {
    return new AppError(msg, 403);
  }
  static notFound(msg = 'not_found'): AppError {
    return new AppError(msg, 404);
  }
  static conflict(msg: string, detail?: unknown): AppError {
    return new AppError(msg, 409, detail);
  }
  static internal(msg = 'internal_error'): AppError {
    return new AppError(msg, 500);
  }
}
