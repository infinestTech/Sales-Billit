// Centralized Payment Method Constants for Backend
// Must match frontend constants for consistency

const PAYMENT_METHODS = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  UPI_H: 'UPI-H',
  UPI_S: 'UPI-S',
  CASH_CARD: 'Cash + Card',
  UPI_H_CASH: 'UPI H + CASH',
  UPI_S_CASH: 'UPI S + CASH',
  UPI_H_CARD: 'UPI H + CARD',
  UPI_S_CARD: 'UPI S + CARD'
};

// Array of all valid payment methods for validation
const VALID_PAYMENT_METHODS = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.UPI,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.UPI_H,
  PAYMENT_METHODS.UPI_S,
  PAYMENT_METHODS.CASH_CARD,
  PAYMENT_METHODS.UPI_H_CASH,
  PAYMENT_METHODS.UPI_S_CASH,
  PAYMENT_METHODS.UPI_H_CARD,
  PAYMENT_METHODS.UPI_S_CARD,
  '' // Allow empty string for optional fields
];

// For Mongoose enum validation (includes lowercase and mixed case variations)
const PAYMENT_METHOD_ENUM = [
  'Cash', 'cash',
  'UPI', 'upi',
  'Card', 'card',
  'UPI-H', 'UPI-h', 'upi-h',
  'UPI-S', 'UPI-s', 'upi-s',
  'Cash + Card',
  'UPI H + CASH',
  'UPI S + CASH',
  'UPI H + CARD',
  'UPI S + CARD',
  'credit', 'Credit',
  '', null
];

// Default payment method
const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS.CASH;

module.exports = {
  PAYMENT_METHODS,
  VALID_PAYMENT_METHODS,
  PAYMENT_METHOD_ENUM,
  DEFAULT_PAYMENT_METHOD
};
