// Development Service Worker
// Simple service worker for development testing

const CACHE_NAME = 'fixel-dev-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing development service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating development service worker...');
  self.clients.claim();
});

// Fetch event - Pass through in development
self.addEventListener('fetch', (event) => {
  // In development, just pass through all requests
  event.respondWith(fetch(event.request));
});

console.log('[SW] Development service worker loaded');
