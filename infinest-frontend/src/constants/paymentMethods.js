// Centralized Payment Method Constants
// Used across the entire application for consistency

export const PAYMENT_METHODS = {
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

// Array format for dropdowns/selects
export const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Select' },
  { value: PAYMENT_METHODS.CASH, label: 'Cash' },
  { value: PAYMENT_METHODS.GPAY, label: 'Gpay' },
  { value: PAYMENT_METHODS.CARD, label: 'Card' },
  { value: PAYMENT_METHODS.GPAY_H, label: 'Gpay-H' },
  { value: PAYMENT_METHODS.GPAY_S, label: 'Gpay-S' },
  { value: PAYMENT_METHODS.CASH_CARD, label: 'Cash + Card' },
  { value: PAYMENT_METHODS.GPAY_H_CASH, label: 'Gpay H + Cash' },
  { value: PAYMENT_METHODS.GPAY_S_CASH, label: 'Gpay S + Cash' },
  { value: PAYMENT_METHODS.GPAY_H_CARD, label: 'Gpay H + Card' },
  { value: PAYMENT_METHODS.GPAY_S_CARD, label: 'Gpay S + Card' }
];

// For backend validation (lowercase versions)
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);

// Default payment method
export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS.CASH;

// Displays legacy "UPI" records (saved before the Gpay rename) as "Gpay" without touching stored data
export const formatPaymentMethodLabel = (method) => {
  if (!method) return method;
  return String(method).replace(/upi/gi, 'Gpay');
};

