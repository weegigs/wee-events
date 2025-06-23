// Custom error classes for business rule violations
export class BusinessRuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleViolationError";
    Object.setPrototypeOf(this, BusinessRuleViolationError.prototype);
  }
}

export class InvalidReceiptStateError extends BusinessRuleViolationError {
  constructor(operation: string, currentState: string) {
    super(`Cannot perform operation '${operation}' on ${currentState} receipt`);
    this.name = "InvalidReceiptStateError";
    Object.setPrototypeOf(this, InvalidReceiptStateError.prototype);
  }
}

export class ItemNotFoundError extends BusinessRuleViolationError {
  constructor(itemName: string) {
    super(`Item '${itemName}' not found on receipt`);
    this.name = "ItemNotFoundError";
    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

export class ReceiptAlreadyVoidedError extends BusinessRuleViolationError {
  constructor() {
    super("Receipt is already voided");
    this.name = "ReceiptAlreadyVoidedError";
    Object.setPrototypeOf(this, ReceiptAlreadyVoidedError.prototype);
  }
}

export class EmptyReceiptError extends BusinessRuleViolationError {
  constructor() {
    super("Cannot finalize receipt with no items");
    this.name = "EmptyReceiptError";
    Object.setPrototypeOf(this, EmptyReceiptError.prototype);
  }
}