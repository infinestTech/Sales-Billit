/**
 * Utility to handle API errors gracefully
 * Specifically handles session expiry without logging to console
 */

/**
 * Check if an error is a session expiry error
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's a session expiry error
 */
export function isSessionExpiredError(error) {
  if (!error) return false;
  
  // Check if it's our custom session expired error from interceptor
  if (error.message === 'Session expired') {
    return true;
  }
  
  // Check if response has session expiry flags
  if (error.response?.data?.sessionExpired || error.response?.data?.loggedOutFromAnotherDevice) {
    return true;
  }
  
  // Check if it's a 401 with session expiry message
  if (error.response?.status === 401 && 
      error.response?.data?.message?.toLowerCase().includes('session')) {
    return true;
  }
  
  return false;
}

/**
 * Safely log errors, but suppress session expiry errors
 * @param {string} context - Context of the error (e.g., "Error fetching data")
 * @param {Error} error - The error object
 */
export function logError(context, error) {
  // Don't log session expiry errors - user will be redirected automatically
  if (isSessionExpiredError(error)) {
    return;
  }
  
  // Log other errors normally
  console.error(context, error);
}

/**
 * Handle API errors in catch blocks
 * Usage: catch(error) { handleApiError('Fetching data', error); }
 * @param {string} context - Context of the error
 * @param {Error} error - The error object
 * @param {Function} [callback] - Optional callback for non-session errors
 */
export function handleApiError(context, error, callback) {
  // Silently handle session expiry (user will be redirected by interceptor)
  if (isSessionExpiredError(error)) {
    return;
  }
  
  // Log other errors
  console.error(context, error);
  
  // Execute callback if provided
  if (callback && typeof callback === 'function') {
    callback(error);
  }
}

/**
 * Wrapper for fetch calls that handles session expiry
 * @param {Function} fetchFn - The fetch function to execute
 * @param {string} errorContext - Error message context
 * @returns {Promise} - Returns the fetch promise
 */
export async function safeFetch(fetchFn, errorContext = 'Error') {
  try {
    return await fetchFn();
  } catch (error) {
    handleApiError(errorContext, error);
    throw error; // Re-throw for component-level handling if needed
  }
}
