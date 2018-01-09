export class InternalInconsistencyError extends Error {
  constructor(message: string) {
    super(`[Internal Inconsistency] ${message}`);
    Object.setPrototypeOf(this, InternalInconsistencyError.prototype);
  }
}
