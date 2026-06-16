/**
 * Feature access utility for handling subscription-based feature restrictions
 */

import { logAndNotify } from '@/utils/logger';

/**
 * Show upgrade notification when user tries to access a restricted feature
 * @param {string} featureName - Name of the feature being accessed
 * @param {string} shopId - Shop ID for storing notification
 * @param {string} requiredPlans - Required subscription plans (e.g., "Gold/Premium")
 */
export const showUpgradeNotification = (featureName, shopId, requiredPlans = "Gold/Premium") => {
  const message = `🚀 Upgrade Required! The ${featureName} feature is available in ${requiredPlans} plans. Upgrade now to unlock this powerful feature and boost your business efficiency.`;
  
  logAndNotify(message, 'warning', shopId);
};

/**
 * Check if a feature is enabled and show upgrade notification if not
 * @param {string} featureKey - Feature key to check
 * @param {string} featureName - Display name of the feature
 * @param {object} features - Features object from PlanFeatureContext
 * @param {string} shopId - Shop ID for storing notification
 * @param {string} requiredPlans - Required subscription plans
 * @returns {boolean} - True if feature is enabled, false otherwise
 */
export const checkFeatureAccess = (featureKey, featureName, features, shopId, requiredPlans = "Gold/Premium") => {
  const isEnabled = features[featureKey]?.enabled;
  
  if (!isEnabled) {
    showUpgradeNotification(featureName, shopId, requiredPlans);
    return false;
  }
  
  return true;
};

/**
 * Create a feature access component that shows upgrade prompt
 * @param {string} featureName - Name of the feature
 * @param {string} description - Description of what the feature does
 * @param {string} requiredPlans - Required subscription plans
 * @param {function} onUpgrade - Function to call when upgrade button is clicked
 * @returns {JSX.Element} - React component
 */
export const createFeatureLockedComponent = (featureName, description, requiredPlans = "Gold/Premium", onUpgrade) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13-9a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">🚀 Feature Locked</h2>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">{featureName}</h3>
          <p className="text-gray-600 mb-6">{description}</p>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2">
            <strong>Available in:</strong> {requiredPlans} plans
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Advanced Features</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Priority Support</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              if (onUpgrade) {
                onUpgrade();
              } else {
                window.location.href = '/pricing';
              }
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
          >
            🚀 Upgrade Now
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Feature access mapping for different features
 */
export const FEATURE_CONFIG = {
  product_inventory: {
    key: 'product_inventory_enabled',
    name: 'Product Inventory Management',
    description: 'Manage your stock, track sales, and get low-stock alerts with our advanced inventory system.',
    requiredPlans: 'Gold/Premium'
  },
  expense_tracker: {
    key: 'expense_tracker_enabled',
    name: 'Expense Tracker',
    description: 'Track your daily expenses, analyze spending patterns, and manage your business finances effectively.',
    requiredPlans: 'Gold/Premium'
  },
  dashboard: {
    key: 'dashboard_enabled',
    name: 'Advanced Dashboard',
    description: 'Get detailed insights about your business with charts, analytics, and performance metrics.',
    requiredPlans: 'Gold/Premium'
  },
  analytics_dashboard: {
    key: 'analytics_dashboard_enabled',
    name: 'Analytics Dashboard',
    description: 'Comprehensive business analytics with interactive charts, financial insights, customer growth tracking, and performance metrics.',
    requiredPlans: 'Premium'
  },
  whatsapp_billing: {
    key: 'allow_whatsapp_billing',
    name: 'WhatsApp Billing',
    description: 'Send professional bills directly to your customers via WhatsApp with one click.',
    requiredPlans: 'Gold/Premium'
  },
  notifications: {
    key: 'notifications_enabled',
    name: 'Smart Notifications',
    description: 'Get real-time alerts for important events, due dates, and business updates.',
    requiredPlans: 'Gold/Premium'
  }
};
