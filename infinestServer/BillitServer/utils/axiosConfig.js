const axios = require('axios');

// Create an axios instance that prefers IPv4
const axiosIPv4 = axios.create({
  // Force IPv4 by setting the family option
  family: 4,  // Use IPv4
  timeout: 10000, // 10 second timeout
});

// For local services, automatically switch https -> http for localhost/127.0.0.1
axiosIPv4.interceptors.request.use((config) => {
  try {
    const base = config.baseURL || undefined;
    const rawUrl = typeof config.url === 'string' ? config.url : '';
    if (!rawUrl) return config;

    const full = new URL(rawUrl, base);
    if ((full.hostname === 'localhost' || full.hostname === '127.0.0.1') && full.protocol === 'https:') {
      full.protocol = 'http:';
      config.url = full.toString();
    }
  } catch (_) {
    // no-op if URL parsing fails
  }
  return config;
});

module.exports = axiosIPv4;
