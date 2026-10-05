"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

// Port of the sales app's SalesFeatureContext / LimitGuard, fed by the shop-admin's sales token.
const SalesFeatureContext = createContext({
  features: {},
  loading: false,
  getFeatureLimit: () => 999,
  isLimitReached: () => false,
});

export function SalesFeatureProvider({ salesUrl, token, children }) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${salesUrl}/api/user/features`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to fetch features: " + res.status);
        const data = await res.json();
        const featureMap = {};
        (Array.isArray(data.features) ? data.features : []).forEach((f) => {
          if (f.type === "boolean") {
            featureMap[f.feature_key] = { enabled: f.enabled, type: f.type, description: f.description };
          } else if (f.type === "limit") {
            featureMap[f.feature_key] = { ...f.config, type: f.type, description: f.description, enabled: true };
          }
        });
        if (!cancelled) setFeatures(featureMap);
      } catch (_) {
        if (!cancelled) setFeatures({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [salesUrl, token]);

  const getFeatureLimit = (featureKey, limitKey) => {
    const feature = features[featureKey];
    if (feature && typeof feature[limitKey] === "number") return feature[limitKey];
    if (feature && feature.config && typeof feature.config[limitKey] === "number") return feature.config[limitKey];
    return 0;
  };

  const isLimitReached = (featureKey, limitKey, currentCount) => currentCount >= getFeatureLimit(featureKey, limitKey);

  return (
    <SalesFeatureContext.Provider value={{ features, loading, getFeatureLimit, isLimitReached }}>
      {children}
    </SalesFeatureContext.Provider>
  );
}

export const useSalesFeatures = () => useContext(SalesFeatureContext);

export function checkSalesFeatureLimit(featureKey, limitKey, currentCount, features, featureName) {
  const feature = features[featureKey];
  if (!feature || feature.type !== "limit") return false;
  const limit = feature[limitKey];
  if (typeof limit !== "number") return false;
  const reached = currentCount >= limit;
  if (reached) {
    alert(`🚀 Upgrade Required! The ${featureName} Limit Reached feature is available in Premium plans. Upgrade now to unlock this powerful feature and boost your sales efficiency.`);
  }
  return reached;
}

export function LimitGuard({ featureKey, limitKey, currentCount, featureName, children, showWarningAt = 0.8 }) {
  const { getFeatureLimit, isLimitReached } = useSalesFeatures();
  const limit = getFeatureLimit(featureKey, limitKey);
  const limitReached = isLimitReached(featureKey, limitKey, currentCount);
  const showWarning = currentCount >= Math.floor(limit * showWarningAt) && !limitReached;

  return (
    <div>
      {showWarning && (
        <div style={{ backgroundColor: "#fef3cd", border: "1px solid #fbbf24", borderRadius: "0.375rem", padding: "0.75rem", marginBottom: "1rem", color: "#92400e" }}>
          {`⚠️ Warning: You're approaching your ${featureName} limit (${currentCount}/${limit}). Consider upgrading for unlimited access.`}
        </div>
      )}
      {children}
    </div>
  );
}
