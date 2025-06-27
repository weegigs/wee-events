import { describe, it, expect } from "vitest";
import { Signal } from "./signal";

describe("Signal", () => {
  it("should resolve the promise when triggered", async () => {
    const signal = new Signal<string>();
    const promise = signal.promise;

    signal.trigger("test");

    await expect(promise).resolves.toBe("test");
  });

  it("should reject the promise when failed", async () => {
    const signal = new Signal<string>();
    const promise = signal.promise;

    signal.fail(new Error("test error"));

    await expect(promise).rejects.toThrow("test error");
  });

  it("should not resolve a triggered signal", async () => {
    const signal = new Signal<string>();
    const promise = signal.promise;

    signal.trigger("first");
    signal.trigger("second");

    await expect(promise).resolves.toBe("first");
  });

  it("should not reject a triggered signal", async () => {
    const signal = new Signal<string>();
    const promise = signal.promise;

    signal.trigger("first");
    signal.fail(new Error("test error"));

    await expect(promise).resolves.toBe("first");
  });

  it("should report triggered status", () => {
    const signal = new Signal();
    expect(signal.isTriggered).toBe(false);
    signal.trigger();
    expect(signal.isTriggered).toBe(true);
  });

  it("should report failed status", () => {
    const signal = new Signal();
    expect(signal.isTriggered).toBe(false);
    signal.fail();
    expect(signal.isTriggered).toBe(true);
    signal.promise.catch(() => {}); // prevent unhandled promise rejection
  });
});
