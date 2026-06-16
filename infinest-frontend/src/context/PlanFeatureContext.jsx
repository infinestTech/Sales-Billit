'use client';


import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';


const PlanFeatureContext = createContext();


// Custom hook for easy feature usage
export const usePlanFeatures = () => useContext(PlanFeatureContext);


export const PlanFeatureProvider = ({ children }) => {
    const [features, setFeatures] = useState({});
    const [loading, setLoading] = useState(true);
    const [trialInfo, setTrialInfo] = useState(null);


    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    console.warn("❌ No token found for feature fetch.");
                    // Provide all features even without token for trial period
                    setAllPremiumFeatures();
                    setLoading(false);
                    return;
                }


                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/user/features`, {
                    headers: { Authorization: `Bearer ${token}` }
                });


                // Set trial info if available
                if (res.data.trial) {
                    setTrialInfo(res.data.trial);
                }

                const featureMap = {};

                res.data.features.forEach(f => {
                    if (f.type === "boolean") {
                        featureMap[f.feature_key] = {
                            enabled: f.enabled,
                            type: f.type,
                            description: f.description,
                        };
                    } else if (f.type === "limit") {
                        featureMap[f.feature_key] = {
                            ...f.config, // includes maxPerCreation, totalPages, entriesPerPage
                            type: f.type,
                            description: f.description,
                        };
                    }
                });


                setFeatures(featureMap);
            } catch (error) {
                console.error("❌ Feature fetch error:", error?.response?.data || error);
                // On error, provide all premium features (fail open for trial)
                setAllPremiumFeatures();
            } finally {
                setLoading(false);
            }
        };

        // Helper to set all premium features
        const setAllPremiumFeatures = () => {
            setFeatures({
                allow_paper_billing: { enabled: true, type: "boolean" },
                allow_whatsapp_billing: { enabled: true, type: "boolean" },
                dashboard_enabled: { enabled: true, type: "boolean" },
                expense_tracker_enabled: { enabled: true, type: "boolean" },
                product_inventory_enabled: { enabled: true, type: "boolean" },
                notifications_enabled: { enabled: true, type: "boolean" },
                analytics_dashboard_enabled: { enabled: true, type: "boolean" },
                show_ads: { enabled: false, type: "boolean" },
                entry_limit: { totalPages: 60, entriesPerPage: 15, type: "limit" },
                dealer_mobile_create_limit: { maxPerCreation: 30, type: "limit" },
            });
        };


        fetchFeatures();
    }, []);


    // ✅ All features are always enabled during trial
    const isFeatureEnabled = (featureKey) => {
        return true; // Always return true during 10-day trial period
    };


    return (
        <PlanFeatureContext.Provider value={{ features, loading, isFeatureEnabled, trialInfo }}>
            {children}
        </PlanFeatureContext.Provider>
    );
};

