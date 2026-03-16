/**
 * Sales Feature access utility for handling subscription-based feature restrictions
 */


/**
 * Show upgrade notification when user tries to access a restricted feature
 * @param {string} featureName - Name of the feature being accessed
 * @param {string} requiredPlans - Required subscription plans (e.g., "Premium")
 */
const showSalesUpgradeNotification = (featureName, requiredPlans = "Premium") => {
  const message = `🚀 Upgrade Required! The ${featureName} feature is available in ${requiredPlans} plans. Upgrade now to unlock this powerful feature and boost your sales efficiency.`;
 
  // Simple alert for now - can be enhanced with toast notifications
  alert(message);
  console.warn("Feature locked:", featureName, "Required plans:", requiredPlans);
};


/**
 * Check if a feature is enabled and show upgrade notification if not
 * @param {string} featureKey - Feature key to check
 * @param {string} featureName - Display name of the feature
 * @param {object} features - Features object from SalesFeatureContext
 * @param {string} requiredPlans - Required subscription plans
 * @returns {boolean} - True if feature is enabled, false otherwise
 */
const checkSalesFeatureAccess = (featureKey, featureName, features, requiredPlans = "Premium") => {
  const isEnabled = features[featureKey]?.enabled;
 
  if (!isEnabled) {
    showSalesUpgradeNotification(featureName, requiredPlans);
    return false;
  }
 
  return true;
};


/**
 * Check if user has reached a feature limit
 * @param {string} featureKey - Feature key to check
 * @param {string} limitKey - Specific limit key (e.g., 'maxBankAccounts')
 * @param {number} currentCount - Current count of items
 * @param {object} features - Features object
 * @param {string} featureName - Display name for notifications
 * @returns {boolean} - True if limit is reached, false otherwise
 */
const checkSalesFeatureLimit = (featureKey, limitKey, currentCount, features, featureName) => {
  const feature = features[featureKey];
  if (!feature || feature.type !== 'limit') return false;
 
  const limit = feature[limitKey];
  if (typeof limit !== 'number') return false;
 
  const isLimitReached = currentCount >= limit;
 
  if (isLimitReached) {
    showSalesUpgradeNotification(
      `${featureName} Limit Reached`,
      "Premium"
    );
  }
 
  return isLimitReached;
};


/**
 * Create a feature access component that shows upgrade prompt
 * @param {string} featureName - Name of the feature
 * @param {string} description - Description of what the feature does
 * @param {string} requiredPlans - Required subscription plans
 * @param {function} onUpgrade - Function to call when upgrade button is clicked
 * @returns {React.Element} - React component
 */
const createSalesFeatureLockedComponent = (featureName, description, requiredPlans = "Premium", onUpgrade) => {
  return React.createElement('div', {
    className: 'feature-locked-container',
    style: {
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f8fafc'
    }
  },
    React.createElement('div', {
      className: 'feature-locked-card',
      style: {
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        padding: '2rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }
    }, [
      React.createElement('div', {
        key: 'icon',
        style: {
          fontSize: '3rem',
          marginBottom: '1rem'
        }
      }, '🔒'),
      React.createElement('h2', {
        key: 'title',
        style: {
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }
      }, '🚀 Feature Locked'),
      React.createElement('h3', {
        key: 'feature-name',
        style: {
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '0.75rem'
        }
      }, featureName),
      React.createElement('p', {
        key: 'description',
        style: {
          color: '#6b7280',
          marginBottom: '1.5rem',
          lineHeight: '1.5'
        }
      }, description),
      React.createElement('div', {
        key: 'plans-info',
        style: {
          backgroundColor: '#f3f4f6',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem'
        }
      }, [
        React.createElement('p', {
          key: 'available-in',
          style: {
            fontSize: '0.875rem',
            color: '#374151',
            marginBottom: '0.5rem'
          }
        }, `Available in: ${requiredPlans} plans`),
        React.createElement('div', {
          key: 'benefits',
          style: {
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            fontSize: '0.75rem'
          }
        }, [
          React.createElement('div', {
            key: 'benefit1',
            style: { display: 'flex', alignItems: 'center', gap: '0.25rem' }
          }, [
            React.createElement('div', {
              key: 'dot1',
              style: {
                width: '0.5rem',
                height: '0.5rem',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }
            }),
            React.createElement('span', { key: 'text1', style: { color: '#6b7280' } }, 'Advanced Features')
          ]),
          React.createElement('div', {
            key: 'benefit2',
            style: { display: 'flex', alignItems: 'center', gap: '0.25rem' }
          }, [
            React.createElement('div', {
              key: 'dot2',
              style: {
                width: '0.5rem',
                height: '0.5rem',
                backgroundColor: '#3b82f6',
                borderRadius: '50%'
              }
            }),
            React.createElement('span', { key: 'text2', style: { color: '#6b7280' } }, 'Priority Support')
          ])
        ])
      ]),
      React.createElement('div', {
        key: 'buttons',
        style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
      }, [
        React.createElement('button', {
          key: 'upgrade-btn',
          onClick: () => {
            if (onUpgrade) {
              onUpgrade();
            } else {
              window.open('/pricing', '_blank');
            }
          },
          style: {
            width: '100%',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: 'white',
            fontWeight: '600',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.875rem'
          },
          onMouseOver: function(e) {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
          },
          onMouseOut: function(e) {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }
        }, '🚀 Upgrade Now'),
        React.createElement('button', {
          key: 'back-btn',
          onClick: () => window.history.back(),
          style: {
            width: '100%',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            fontWeight: '600',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.875rem'
          },
          onMouseOver: function(e) {
            e.target.style.backgroundColor = '#e5e7eb';
          },
          onMouseOut: function(e) {
            e.target.style.backgroundColor = '#f3f4f6';
          }
        }, '← Go Back')
      ])
    ])
  );
};


/**
 * Feature access mapping for different sales features
 */
const SALES_FEATURE_CONFIG = {
  suppliers: {
    enabledKey: 'suppliers_enabled',
    limitKey: 'supplier_limit',
    name: 'Supplier Management',
    description: 'Add and manage suppliers for your inventory and supply chain operations.',
    requiredPlans: 'Premium'
  },
  gst_calculator: {
    enabledKey: 'gst_calculator_enabled',
    name: 'GST Calculator',
    description: 'Calculate GST for your transactions and maintain tax compliance with advanced GST tools.',
    requiredPlans: 'Premium'
  },
  payment_history: {
    enabledKey: 'payment_history_enabled',
    name: 'Payment History',
    description: 'Track and analyze your payment history with detailed financial reports.',
    requiredPlans: 'Premium'
  },
  supply_history: {
    enabledKey: 'supply_history_enabled',
    name: 'Supply History',
    description: 'Monitor your supply chain history and track supplier performance over time.',
    requiredPlans: 'Premium'
  },
  branch_management: {
    enabledKey: 'branch_management_enabled',
    limitKey: 'branch_limit',
    name: 'Branch Management',
    description: 'Create and manage multiple branches for your business operations.',
    requiredPlans: 'Premium'
  },
  inventory_volume: {
    limitKey: 'total_inventory_volume',
    name: 'Inventory Management',
    description: 'Manage your product inventory with advanced tracking and analytics.',
    requiredPlans: 'Premium'
  }
};


// Register globally for access
window.showSalesUpgradeNotification = showSalesUpgradeNotification;
window.checkSalesFeatureAccess = checkSalesFeatureAccess;
window.checkSalesFeatureLimit = checkSalesFeatureLimit;
window.createSalesFeatureLockedComponent = createSalesFeatureLockedComponent;
window.SALES_FEATURE_CONFIG = SALES_FEATURE_CONFIG;




