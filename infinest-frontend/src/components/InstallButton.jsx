'use client';

import { useState, useEffect } from 'react';
import { Download, Smartphone } from 'lucide-react';

const InstallButton = ({ className = '', variant = 'primary', size = 'md' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone ||
                          document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        const choiceResult = await deferredPrompt.prompt();
        console.log('User choice:', choiceResult.outcome);
        
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        
        setDeferredPrompt(null);
        setIsInstallable(false);
      } catch (error) {
        console.error('Error showing install prompt:', error);
      }
    }
  };

  // Don't show if already installed or not installable
  if (isInstalled || !isInstallable) {
    return null;
  }

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
    };

    return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} rounded-md ${className}`;
  };

  return (
    <button
      onClick={handleInstall}
      className={getButtonClasses()}
      aria-label="Install Fixel app"
    >
      <Download className="w-4 h-4 mr-2" />
      Install App
    </button>
  );
};

export default InstallButton;
