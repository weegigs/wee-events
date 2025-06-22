import { describe, it, expect } from "vitest";
import { range } from "./range";

describe("range", () => {
  it("should generate range with default parameters", () => {
    const result = Array.from(range());
    expect(result).toEqual([]);
  });

  it("should generate range with specified total", () => {
    const result = Array.from(range(5));
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("should generate range with custom step", () => {
    const result = Array.from(range(5, 2));
    expect(result).toEqual([0, 2, 4, 6, 8]);
  });

  it("should generate range with custom starting value", () => {
    const result = Array.from(range(5, 1, 10));
    expect(result).toEqual([10, 11, 12, 13, 14]);
  });

  it("should generate range with negative step", () => {
    const result = Array.from(range(5, -1, 10));
    expect(result).toEqual([10, 9, 8, 7, 6]);
  });

  it("should generate range with decimal step", () => {
    const result = Array.from(range(3, 0.5, 1));
    expect(result).toEqual([1, 1.5, 2]);
  });

  it("should handle zero total", () => {
    const result = Array.from(range(0));
    expect(result).toEqual([]);
  });

  it("should handle negative total as zero", () => {
    const result = Array.from(range(-5));
    expect(result).toEqual([]);
  });

  it("should work as iterator", () => {
    const generator = range(3);
    
    expect(generator.next().value).toBe(0);
    expect(generator.next().value).toBe(1);
    expect(generator.next().value).toBe(2);
    expect(generator.next().done).toBe(true);
  });

  it("should handle large ranges efficiently", () => {
    const generator = range(1000);
    const first = generator.next().value;
    const second = generator.next().value;
    
    expect(first).toBe(0);
    expect(second).toBe(1);
    
    // Skip to end to verify it can handle large ranges
    let count = 2;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _value of generator) {
      count++;
      if (count > 10) break; // Just test a few more values
    }
    expect(count).toBeGreaterThan(10);
  });

  it("should work with for...of loop", () => {
    const result: number[] = [];
    for (const value of range(3, 1, 5)) {
      result.push(value);
    }
    expect(result).toEqual([5, 6, 7]);
  });

  it("should handle zero step", () => {
    const result = Array.from(range(3, 0, 5));
    expect(result).toEqual([5, 5, 5]);
  });
});