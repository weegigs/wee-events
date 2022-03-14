import { Revision } from "../types";

export class RevisionConflictError extends Error {
  override readonly name = "revision-conflict";

  constructor() {
    super("revision conflict detected");

    Object.setPrototypeOf(this, RevisionConflictError.prototype);
  }
}

export class ExpectedRevisionConflictError extends Error {
  override readonly name = "expected-revision-conflict";

  constructor(expected: Revision) {
    super(`revision did not match the expected revision of ${expected}`);

    Object.setPrototypeOf(this, ExpectedRevisionConflictError.prototype);
  }
}

export namespace Errors {
  export const isRevisionConflict = (error: unknown): error is RevisionConflictError => {
    return error instanceof RevisionConflictError;
  };

  export const isExpectedRevisionConflict = (error: unknown): error is ExpectedRevisionConflictError => {
    return error instanceof ExpectedRevisionConflictError;
  };
}
