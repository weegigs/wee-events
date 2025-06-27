/**
 * A signal that can be awaited and triggered from an external context.
 * Useful for coordinating asynchronous operations, such as graceful shutdowns.
 */
export class Signal<T = void> {
  public readonly promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _reject!: (reason?: unknown) => void;
  private _isTriggered = false;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Checks if the signal has already been triggered.
   */
  public get isTriggered(): boolean {
    return this._isTriggered;
  }

  /**
   * Triggers the signal, resolving the promise with the given value.
   * Has no effect if the signal has already been triggered.
   */
  public trigger(value: T): void {
    if (!this._isTriggered) {
      this._isTriggered = true;
      this._resolve(value);
    }
  }

  /**
   * Fails the signal, rejecting the promise with the given reason.
   * Has no effect if the signal has already been triggered.
   */
  public fail(reason?: unknown): void {
    if (!this._isTriggered) {
      this._isTriggered = true;
      this._reject(reason);
    }
  }
}
