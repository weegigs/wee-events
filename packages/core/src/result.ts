export interface Result<R, E> {
  readonly result?: R;
  readonly error?: E;

  map<U>(f: (result: R) => U): Result<U, E>;
  flatMap<U>(f: (result: R) => Result<U, E>): Result<U, E>;

  mapError<U>(f: (error: E) => U): Result<R, U>;
  flatMapError<U>(f: (error: E) => Result<R, U>): Result<R, U>;

  recover(f: (error: E) => R): Result<R, E>;

  withResult(f: (result: R) => void): Result<R, E>;
  withError(f: (error: E) => void): Result<R, E>;
  with(success: (result: R) => void, failure: (error: E) => void): Result<R, E>;
}

// // monoid, a collection of things, plus a rule for combining them according to rules

// // (a • b) • c == a • (b • c)

// // f<t>(v: t) -> t

// // (a • b) -> v -> t
// export function monoid<t>(a: (v: t) => t, b: (v: t) => t): (v: t) => t {
//   return (v: t) => b(a(v));
// }

export function success<T, E = Error>(value: T): Result<T, E> {
  return new Success(value);
}

export function failure<T, E = Error>(value: E): Result<T, E> {
  return new Failure(value);
}

class Success<R, E> implements Result<R, E> {
  constructor(private r: R) {}

  get result(): R | undefined {
    return this.r;
  }

  get error(): E | undefined {
    return undefined;
  }

  map<U>(f: (value: R) => U): Result<U, E> {
    const value = this.r;
    return success(f(value));
  }

  flatMap<U>(f: (value: R) => Result<U, E>): Result<U, E> {
    return f(this.r);
  }

  mapError<U>(f: (error: E) => U): Result<R, U> {
    return success(this.r);
  }

  flatMapError<U>(f: (error: E) => Result<R, U>): Result<R, U> {
    return success(this.r);
  }

  recover(f: (error: E) => R): Result<R, E> {
    return success(this.r);
  }

  with(succeeded: (value: R) => void, fail: (value: E) => void): Result<R, E> {
    return this.withResult(succeeded);
  }

  withResult(f: (result: R) => void): Result<R, E> {
    f(this.r);
    return this;
  }

  withError(f: (error: E) => void): Result<R, E> {
    return this;
  }
}

class Failure<R, E> implements Result<R, E> {
  constructor(private e: E) {}

  get result(): R | undefined {
    return undefined;
  }

  get error(): E | undefined {
    return this.e;
  }

  unit(value: R): Result<R, E> {
    throw new Error("Method not implemented.");
  }

  map<U>(f: (value: R) => U): Result<U, E> {
    return failure(this.e);
  }

  flatMap<U>(f: (value: R) => Result<U, E>): Result<U, E> {
    return failure(this.e);
  }

  mapError<U>(f: (error: E) => U): Result<R, U> {
    return failure(f(this.e));
  }

  flatMapError<U>(f: (error: E) => Result<R, U>): Result<R, U> {
    return f(this.e);
  }

  recover(f: (error: E) => R): Result<R, E> {
    return success(f(this.e));
  }

  with(succeeded: (value: R) => void, failed: (value: E) => void): Result<R, E> {
    return this.withError(failed);
  }

  withResult(f: (result: R) => void): Result<R, E> {
    return this;
  }

  withError(f: (error: E) => void): Result<R, E> {
    f(this.e);
    return this;
  }
}
