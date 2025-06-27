/**
 * @module
 * @description
 * This module defines a contract for errors that can be safely serialized
 * and reconstituted across service boundaries.
 */

/**
 * An interface for errors that can be serialized to a plain JavaScript object.
 * This allows domain-specific errors to control their own representation when
 * being sent over the wire, ensuring that all necessary information for
 * reconstitution is preserved.
 */
export interface ISerializableError {
  /**
   * Returns a JSON-serializable representation of the error's critical properties.
   *
   * @returns A plain object containing the data needed to reconstitute the error.
   */
  toJSON(): Record<string, unknown>;
}