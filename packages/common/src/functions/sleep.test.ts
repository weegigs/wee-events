import { describe, it, expect } from "vitest";
import { sleep } from "./sleep";

describe("sleep", () => {
  it("should resolve after specified delay", async () => {
    const start = Date.now();
    const delay = 100;
    
    await sleep(delay);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(delay);
    expect(elapsed).toBeLessThan(delay + 50); // Allow 50ms tolerance
  });

  it("should resolve immediately with zero delay", async () => {
    const start = Date.now();
    
    await sleep(0);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10); // Should be very fast
  });

  it("should handle negative delay as zero", async () => {
    const start = Date.now();
    
    await sleep(-100);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10); // Should be very fast
  });

  it("should return a promise", () => {
    const result = sleep(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("should resolve with undefined", async () => {
    const result = await sleep(1);
    expect(result).toBeUndefined();
  });
});