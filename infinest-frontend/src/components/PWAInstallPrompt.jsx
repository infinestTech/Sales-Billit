'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download, Smartphone, Plus } from 'lucide-react';

const PWAInstallPrompt = () => {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // Only show PWA prompt on specific routes
    const allowedRoutes = ['/billit-login', '/application'];
    const isAllowedRoute = allowedRoutes.some(route => pathname?.startsWith(route));
    
    if (!isAllowedRoute) {
      return;
    }

    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if app is already installed (running in standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone || 
                     document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if user has previously dismissed the prompt
    const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-dismissed');
    const dismissedTime = localStorage.getItem('pwa-install-prompt-dismissed-time');
    
    // Show prompt again after 3 days
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const shouldShowAgain = !dismissedTime || parseInt(dismissedTime) < threeDaysAgo;

    // Only show prompt if not already installed and user hasn't recently dismissed it
    if (!standalone && (!hasSeenPrompt || shouldShowAgain)) {
      // For non-iOS devices, listen for beforeinstallprompt event
      if (!iOS) {
        const handleBeforeInstallPrompt = (e) => {
          e.preventDefault();
          setDeferredPrompt(e);
          // Show prompt after 2 seconds delay
          setTimeout(() => setShowInstallPrompt(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
      } else {
        // For iOS devices, show custom prompt after a short delay
        const timer = setTimeout(() => {
          setShowInstallPrompt(true);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  const handleInstallClick = async () => {
    if (deferredPrompt && !isIOS) {
      // For Android/Chrome
      try {
        const choiceResult = await deferredPrompt.prompt();
        console.log('User choice:', choiceResult.outcome);
        
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setShowInstallPrompt(false);
        }
      } catch (error) {
        console.error('Error showing install prompt:', error);
      }
      
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-prompt-dismissed', 'true');
    localStorage.setItem('pwa-install-prompt-dismissed-time', Date.now().toString());
  };

  const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad Pro
  };

  // Don't show if not mobile, already installed, or user dismissed
  if (!isMobile() || isStandalone || !showInstallPrompt) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleDismiss} />
      
      {/* Install Prompt */}
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white relative">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors p-1"
              aria-label="Dismiss install prompt"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Install Fixel</h3>
                <p className="text-blue-100 text-sm">Add to your home screen</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 text-gray-800">
            <div className="flex items-start space-x-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg mt-1">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Quick Access</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Install Fixel for faster access and a better mobile experience. Works offline too!
                </p>
              </div>
            </div>
            
            {isIOS ? (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">How to install on iOS:</span>
                </div>
                <ol className="text-xs text-blue-700 space-y-1 ml-6 list-decimal">
                  <li>Tap the <strong>Share</strong> button in Safari</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>"Add"</strong> to confirm</li>
                </ol>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleInstallClick}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Install</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PWAInstallPrompt;
