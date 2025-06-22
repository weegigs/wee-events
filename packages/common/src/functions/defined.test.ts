import { describe, it, expect } from "vitest";
import { defined } from "./defined";

describe("defined", () => {
  it("should return true for non-null/undefined values", () => {
    expect(defined(0)).toBe(true);
    expect(defined("")).toBe(true);
    expect(defined("hello")).toBe(true);
    expect(defined([])).toBe(true);
    expect(defined({})).toBe(true);
    expect(defined(false)).toBe(true);
    expect(defined(true)).toBe(true);
    expect(defined(-1)).toBe(true);
    expect(defined(NaN)).toBe(true);
  });

  it("should return false for null", () => {
    expect(defined(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(defined(undefined)).toBe(false);
  });

  it("should work as type guard", () => {
    const value: string | undefined = Math.random() > 0.5 ? "hello" : undefined;
    
    if (defined(value)) {
      // TypeScript should know value is string here
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(value).toBeUndefined();
    }
  });

  it("should work with arrays containing undefined", () => {
    const array = [1, undefined, 3, null, 5];
    const filtered = array.filter(defined);
    
    expect(filtered).toEqual([1, 3, 5]);
  });

  it("should work with complex objects", () => {
    const obj = { key: "value" };
    const nullObj = null;
    const undefinedObj = undefined;
    
    expect(defined(obj)).toBe(true);
    expect(defined(nullObj)).toBe(false);
    expect(defined(undefinedObj)).toBe(false);
  });

  it("should handle function values", () => {
    const fn = () => {};
    const nullFn = null;
    const undefinedFn = undefined;
    
    expect(defined(fn)).toBe(true);
    expect(defined(nullFn)).toBe(false);
    expect(defined(undefinedFn)).toBe(false);
  });

  it("should work with optional chaining results", () => {
    const obj: { nested?: { value?: string } } = {};
    
    const value1 = obj.nested?.value;
    const value2 = { nested: { value: "test" } }.nested?.value;
    
    expect(defined(value1)).toBe(false);
    expect(defined(value2)).toBe(true);
  });
});