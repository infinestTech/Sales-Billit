// Feature Guard Component for wrapping views with feature access control
function FeatureGuard({ featureKey, featureName, requiredPlans, children, fallbackComponent }) {
  const { features, loading, isFeatureEnabled, trialInfo, userPlan } = window.useSalesFeatures ? window.useSalesFeatures() : { 
    features: {}, 
    loading: false, 
    isFeatureEnabled: () => true,
    trialInfo: null,
    userPlan: ''
  };

  if (loading) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        fontSize: '1.1rem',
        color: '#6b7280'
      }
    }, 'Loading...');
  }

  // ✅ Always allow access during trial period or for premium plans
  const hasAccess = isFeatureEnabled(featureKey);

  if (!hasAccess) {
    if (fallbackComponent) {
      return fallbackComponent;
    }
    
    return window.createSalesFeatureLockedComponent(
      featureName,
      window.SALES_FEATURE_CONFIG[featureKey.replace('_enabled', '')]?.description || 'This feature requires a higher subscription plan.',
      requiredPlans,
      () => window.open('/pricing', '_blank')
    );
  }

  return children;
}

// Higher-order component for wrapping views
function withFeatureGuard(Component, featureKey, featureName, requiredPlans) {
  return function WrappedComponent(props) {
    return React.createElement(FeatureGuard, {
      featureKey,
      featureName,
      requiredPlans
    }, React.createElement(Component, props));
  };
}

// Limit Guard Component for checking limits before actions
function LimitGuard({ 
  featureKey, 
  limitKey, 
  currentCount, 
  featureName, 
  children, 
  onLimitReached,
  showWarningAt = 0.8 // Show warning when 80% of limit is reached
}) {
  const { features, getFeatureLimit, isLimitReached } = window.useSalesFeatures ? window.useSalesFeatures() : { 
    features: {}, 
    getFeatureLimit: () => 999, 
    isLimitReached: () => false 
  };

  const limit = getFeatureLimit(featureKey, limitKey);
  const limitReached = isLimitReached(featureKey, limitKey, currentCount);
  const warningThreshold = Math.floor(limit * showWarningAt);
  const showWarning = currentCount >= warningThreshold && !limitReached;

  React.useEffect(() => {
    if (limitReached && onLimitReached) {
      onLimitReached(limit, currentCount);
    }
  }, [limitReached, limit, currentCount]);

  return React.createElement('div', {}, [
    showWarning && React.createElement('div', {
      key: 'warning',
      style: {
        backgroundColor: '#fef3cd',
        border: '1px solid #fbbf24',
        borderRadius: '0.375rem',
        padding: '0.75rem',
        marginBottom: '1rem',
        color: '#92400e'
      }
    }, `⚠️ Warning: You're approaching your ${featureName} limit (${currentCount}/${limit}). Consider upgrading for unlimited access.`),
    
    children
  ]);
}

// Register globally
window.FeatureGuard = FeatureGuard;
window.withFeatureGuard = withFeatureGuard;
window.LimitGuard = LimitGuard;
