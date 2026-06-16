// Environment configuration for sales frontend
// This file provides environment variables globally

window.ENV_CONFIG = {
  SALES_API_URL: '${SALES_API_URL}',
  AUTH_API_URL: '${AUTH_API_URL}',
  WHATSAPP_WEB_URL: '${WHATSAPP_WEB_URL}'
};

// For backward compatibility, also set SALES_URL
window.SALES_URL = window.ENV_CONFIG.SALES_API_URL;

console.log('🔧 Environment config loaded:', window.ENV_CONFIG);
