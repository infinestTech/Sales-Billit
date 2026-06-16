/**
 * Mobile-optimized feature locked component
 */

import { Lock, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const createMobileFeatureLockedComponent = (featureName, description, requiredPlans = "Gold/Premium", onUpgrade) => {
  return (
    <div className="p-4 flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center">
          {/* Lock Icon */}
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {featureName}
          </h3>
          
          {/* Description */}
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            {description}
          </p>
          
          {/* Required Plan Badge */}
          <div className="inline-flex items-center space-x-1 bg-gradient-to-r from-blue-100 to-purple-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            <span>Requires {requiredPlans}</span>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                if (onUpgrade) {
                  onUpgrade();
                } else {
                  window.location.href = '/pricing';
                }
              }}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 text-sm"
            >
              🚀 Upgrade Now
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
            >
              ← Go Back
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
