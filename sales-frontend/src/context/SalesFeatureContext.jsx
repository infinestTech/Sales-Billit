// Sales Feature Context for managing conditional rendering
function SalesFeatureProvider({ children }) {
  const [features, setFeatures] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [userPlan, setUserPlan] = React.useState('');
  const [trialInfo, setTrialInfo] = React.useState(null);

  const SALES_URL = window.ENV_CONFIG?.SALES_API_URL || 'http://127.0.0.1:9000';

  const fetchFeatures = async () => {
    try {
      const token = localStorage.getItem('sales_token');
      if (!token) {
        setFeatures({}); // Clear features when no token
        setLoading(false);
        return;
      }

      const res = await fetch(`${SALES_URL}/api/user/features`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch features: ' + res.status);
      }

      const data = await res.json();
      console.log('📦 Features API Response:', data);
      const featureMap = {};

      // Process features from MongoDB format
      if (data.features && Array.isArray(data.features)) {
        data.features.forEach(f => {
          if (f.type === "boolean") {
            featureMap[f.feature_key] = {
              enabled: f.enabled,
              type: f.type,
              description: f.description,
            };
          } else if (f.type === "limit") {
            featureMap[f.feature_key] = {
              ...f.config, // includes maxSuppliers, etc.
              type: f.type,
              description: f.description,
              enabled: true // Limit features are considered "enabled" 
            };
          }
        });
      }

      // Extract user plan from response
      if (data.userPlan) {
        setUserPlan(data.userPlan);
      }

      // Set trial info if available
      if (data.trial) {
        setTrialInfo(data.trial);
        console.log('✅ Trial info loaded:', data.trial);
      }

      setFeatures(featureMap);
      console.log('✅ Features loaded:', featureMap);
      console.log('✅ User plan:', data.userPlan);
    } catch (error) {
      // Set empty features on error
      setFeatures({});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchFeatures();
    
    // Listen for login events to refetch features
    const handleLoginEvent = () => {
      fetchFeatures();
    };
    
    window.addEventListener('sales-login', handleLoginEvent);
    return () => window.removeEventListener('sales-login', handleLoginEvent);
  }, []);

  // ✅ Feature access control:
  // - During trial plan (1 month): ALL premium features enabled (Trial plan gets Premium features)
  // - After trial ends: Login is BLOCKED, user must upgrade to Premium
  // - Premium plan: Always has full feature access
  const isFeatureEnabled = (featureKey) => {
    // During trial or Premium plan, all features are enabled
    if (trialInfo && trialInfo.isOnTrial) {
      console.log(`✅ Trial active - enabling ${featureKey}`);
      return true;
    }

    // Premium plan has all features
    if (userPlan === 'sales-premium') {
      console.log(`✅ Premium plan - enabling ${featureKey}`);
      return true;
    }

    // Trial expired and not Premium = should not reach here (login should be blocked)
    console.log(`❌ Trial expired and not Premium - ${featureKey} disabled`);
    return false;
  };

  // Utility to get feature limit value
  const getFeatureLimit = (featureKey, limitKey) => {
    // During trial or for Premium plan, get the actual limit from features
    // Trial users get the same limits as Premium plan
    const feature = features[featureKey];
    
    console.log(`🔍 getFeatureLimit(${featureKey}, ${limitKey}):`, feature);
    
    // Check direct property on feature first (this is where limit values are after spreading ...f.config)
    if (feature && typeof feature[limitKey] === 'number') {
      console.log(`✅ Found limit: ${feature[limitKey]}`);
      return feature[limitKey];
    }
    
    // Fallback: check nested config object (for backward compatibility)
    if (feature && feature.config && typeof feature.config[limitKey] === 'number') {
      console.log(`✅ Found limit in config: ${feature.config[limitKey]}`);
      return feature.config[limitKey];
    }
    
    console.log(`❌ No limit found, returning 0`);
    // Default to 0 if no limit found
    return 0;
  };

  // Utility to check if user has reached a limit
  const isLimitReached = (featureKey, limitKey, currentCount) => {
    const limit = getFeatureLimit(featureKey, limitKey);
    return currentCount >= limit;
  };

  const contextValue = {
    features,
    loading,
    userPlan,
    trialInfo,
    isFeatureEnabled,
    getFeatureLimit,
    isLimitReached,
    refetchFeatures: fetchFeatures
  };

  return React.createElement(
    SalesFeatureContext.Provider,
    { value: contextValue },
    children
  );
}

// Create context
const SalesFeatureContext = React.createContext();

// Custom hook for easy feature usage
const useSalesFeatures = () => React.useContext(SalesFeatureContext);

// Register globally
window.SalesFeatureProvider = SalesFeatureProvider;
window.SalesFeatureContext = SalesFeatureContext;
window.useSalesFeatures = useSalesFeatures;
