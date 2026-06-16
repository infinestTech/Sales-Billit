// Centralized Payment Method Constants
// Used across the entire application for consistency

export const PAYMENT_METHODS = {
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

// Array format for dropdowns/selects
export const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Select' },
  { value: PAYMENT_METHODS.CASH, label: 'Cash' },
  { value: PAYMENT_METHODS.UPI, label: 'UPI' },
  { value: PAYMENT_METHODS.CARD, label: 'Card' },
  { value: PAYMENT_METHODS.UPI_H, label: 'UPI-H' },
  { value: PAYMENT_METHODS.UPI_S, label: 'UPI-S' },
  { value: PAYMENT_METHODS.CASH_CARD, label: 'Cash + Card' },
  { value: PAYMENT_METHODS.UPI_H_CASH, label: 'UPI H + Cash' },
  { value: PAYMENT_METHODS.UPI_S_CASH, label: 'UPI S + Cash' },
  { value: PAYMENT_METHODS.UPI_H_CARD, label: 'UPI H + Card' },
  { value: PAYMENT_METHODS.UPI_S_CARD, label: 'UPI S + Card' }
];

// For backend validation (lowercase versions)
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);

// Default payment method
export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS.CASH;
