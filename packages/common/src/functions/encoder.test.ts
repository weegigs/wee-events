import { describe, it, expect } from "vitest";
import { DeflateEncoder } from "./encoder";

describe("DeflateEncoder", () => {
  describe("encode", () => {
    it("should compress and encode buffer to base64 string", async () => {
      const input = Buffer.from("Hello, World!", "utf8");
      
      const result = await DeflateEncoder.encode(input);
      
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // Should not contain standard base64 characters that get replaced
      expect(result).not.toMatch(/[+/=]/);
    });

    it("should handle empty buffer", async () => {
      const input = Buffer.alloc(0);
      
      const result = await DeflateEncoder.encode(input);
      
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle large buffer", async () => {
      const input = Buffer.from("A".repeat(10000), "utf8");
      
      const result = await DeflateEncoder.encode(input);
      
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(input.length); // Should be compressed
    });

    it("should replace base64 characters consistently", async () => {
      const input = Buffer.from("Test data that might generate +/= in base64", "utf8");
      
      const result = await DeflateEncoder.encode(input);
      
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });
  });

  describe("decode", () => {
    it("should decompress encoded string back to original buffer", async () => {
      const original = Buffer.from("Hello, World!", "utf8");
      
      const encoded = await DeflateEncoder.encode(original);
      const decoded = await DeflateEncoder.decode(encoded);
      
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect(decoded.toString("utf8")).toBe(original.toString("utf8"));
    });

    it("should handle empty string correctly", async () => {
      const original = Buffer.alloc(0);
      
      const encoded = await DeflateEncoder.encode(original);
      const decoded = await DeflateEncoder.decode(encoded);
      
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect(decoded.length).toBe(0);
    });

    it("should handle large data round trip", async () => {
      const original = Buffer.from("Large data: " + "X".repeat(5000), "utf8");
      
      const encoded = await DeflateEncoder.encode(original);
      const decoded = await DeflateEncoder.decode(encoded);
      
      expect(decoded.toString("utf8")).toBe(original.toString("utf8"));
    });

    it("should throw error for invalid base64 input", async () => {
      const invalidBase64 = "invalid!@#$%^&*()";
      
      await expect(DeflateEncoder.decode(invalidBase64)).rejects.toThrow();
    });
  });

  describe("round trip", () => {
    it("should maintain data integrity through encode/decode cycle", async () => {
      const testCases = [
        "Simple text",
        "Text with special chars: !@#$%^&*()",
        "Unicode: 🚀 Hello 世界",
        JSON.stringify({ key: "value", number: 42, array: [1, 2, 3] }),
        "",
        "A".repeat(1000)
      ];

      for (const testCase of testCases) {
        const original = Buffer.from(testCase, "utf8");
        const encoded = await DeflateEncoder.encode(original);
        const decoded = await DeflateEncoder.decode(encoded);
        
        expect(decoded.toString("utf8")).toBe(testCase);
      }
    });
  });
});