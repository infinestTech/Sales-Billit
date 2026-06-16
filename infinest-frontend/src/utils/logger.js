/**
 * Logger utility for handling user notifications and system logging
 */

// Log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

/**
 * Log a message to console with timestamp
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {any} data - Additional data to log
 */
const logToConsole = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage, data ? data : '');
};

/**
 * Send notification to user via the notification system
 * @param {string} message - Message to show to user
 * @param {string} type - Type of notification (success, error, warning, info)
 * @param {string} shopId - Shop ID for storing notification
 */
const showNotification = async (message, type = 'info', shopId = null) => {
  try {
    // Store notification in database if shopId is provided
    if (shopId) {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/notifications/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            shop_id: shopId,
            message: message,
            type: type,
          }),
        });
      }
    }

    // Show toast notification
    window.dispatchEvent(new CustomEvent('show-notification-toast', {
      detail: {
        message: message,
        type: type
      }
    }));

    // Trigger notification refresh for inbox
    window.dispatchEvent(new Event('refresh-notifications'));
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};

/**
 * Log and show user notification
 * @param {string} message - Message to show
 * @param {string} type - Type (success, error, warning, info)
 * @param {string} shopId - Shop ID for storing notification
 */
export const logAndNotify = (message, type = 'info', shopId = null) => {
  logToConsole(type.toUpperCase(), message);
  showNotification(message, type, shopId);
};

/**
 * Log system message (console only, no user notification)
 * @param {string} message - Message to log
 * @param {string} level - Log level
 * @param {any} data - Additional data to log
 */
export const logSystem = (message, level = 'INFO', data = null) => {
  logToConsole(level, message, data);
};

/**
 * Log error with stack trace
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {string} shopId - Shop ID for storing notification
 */
export const logError = (message, error, shopId = null) => {
  const errorDetails = error?.stack || error?.message || error;
  logSystem(`${message}: ${errorDetails}`, LOG_LEVELS.ERROR, error);
  
  // Only show user-friendly error messages to users
  if (shopId) {
    showNotification(message, 'error', shopId);
  }
};

/**
 * Log success message
 * @param {string} message - Success message
 * @param {string} shopId - Shop ID for storing notification
 */
export const logSuccess = (message, shopId = null) => {
  logSystem(message, LOG_LEVELS.SUCCESS);
  if (shopId) {
    showNotification(message, 'success', shopId);
  }
};

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {string} shopId - Shop ID for storing notification
 */
export const logWarning = (message, shopId = null) => {
  logSystem(message, LOG_LEVELS.WARN);
  if (shopId) {
    showNotification(message, 'warning', shopId);
  }
};

/**
 * Log info message
 * @param {string} message - Info message
 * @param {string} shopId - Shop ID for storing notification
 */
export const logInfo = (message, shopId = null) => {
  logSystem(message, LOG_LEVELS.INFO);
  if (shopId) {
    showNotification(message, 'info', shopId);
  }
};
