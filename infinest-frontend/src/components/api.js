// components/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_BILLIT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Flag to prevent multiple redirects
let isRedirecting = false;

// ✅ Add response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if error response indicates session expired or logged out from another device
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle session expiration (401 or 403 with sessionExpired flag)
      if (
        (status === 401 || status === 403) && 
        (data?.sessionExpired || data?.loggedOutFromAnotherDevice)
      ) {
        // Prevent multiple redirects
        if (isRedirecting) {
          return Promise.reject(new Error('Session expired'));
        }
        
        isRedirecting = true;
        
        // Clear local storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          localStorage.removeItem('profileImage');
          localStorage.removeItem('profileName');
          
          // Show user-friendly message
          const message = data?.loggedOutFromAnotherDevice 
            ? 'You have been logged out because you logged in from another device.'
            : 'Your session has expired. Please login again.';
          
          // Redirect to login page
          window.location.href = '/billit-login?expired=true&reason=' + encodeURIComponent(message);
        }
        
        // Return a rejected promise with a clean error message (won't log in console)
        return Promise.reject(new Error('Session expired'));
      }
    }
    
    // For other errors, reject normally
    return Promise.reject(error);
  }
);

export default api;

