// Centralized Payment Method Constants for Backend
// Must match frontend constants for consistency

const PAYMENT_METHODS = {
  CASH: 'Cash',
  GPAY: 'Gpay',
  CARD: 'Card',
  GPAY_H: 'Gpay-H',
  GPAY_S: 'Gpay-S',
  CASH_CARD: 'Cash + Card',
  GPAY_H_CASH: 'Gpay H + CASH',
  GPAY_S_CASH: 'Gpay S + CASH',
  GPAY_H_CARD: 'Gpay H + CARD',
  GPAY_S_CARD: 'Gpay S + CARD'
};

// Array of all valid payment methods for validation
const VALID_PAYMENT_METHODS = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.GPAY,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.GPAY_H,
  PAYMENT_METHODS.GPAY_S,
  PAYMENT_METHODS.CASH_CARD,
  PAYMENT_METHODS.GPAY_H_CASH,
  PAYMENT_METHODS.GPAY_S_CASH,
  PAYMENT_METHODS.GPAY_H_CARD,
  PAYMENT_METHODS.GPAY_S_CARD,
  '' // Allow empty string for optional fields
];

// For Mongoose enum validation (includes lowercase, mixed case, and legacy "UPI" values from before the Gpay rename)
const PAYMENT_METHOD_ENUM = [
  'Cash', 'cash',
  'Gpay', 'gpay',
  'UPI', 'upi',
  'Card', 'card',
  'Gpay-H', 'Gpay-h', 'gpay-h',
  'Gpay-S', 'Gpay-s', 'gpay-s',
  'UPI-H', 'UPI-h', 'upi-h',
  'UPI-S', 'UPI-s', 'upi-s',
  'Cash + Card',
  'Gpay H + CASH',
  'Gpay S + CASH',
  'Gpay H + CARD',
  'Gpay S + CARD',
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
