"use client"

import { Zap } from "lucide-react"
import PlanCard from "./plan-card"

export default function PricingSection({ title = "Choose Your Plan", subtitle, plans = [], isLoading = false, error = null }) {
  return (
    <section className="relative min-h-screen bg-black overflow-hidden py-20 px-4">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />

      {/* Gradient Orbs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-white/5 to-transparent rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-l from-white/5 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-white/3 to-transparent rounded-full blur-2xl animate-pulse delay-500" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        {(title || subtitle) && (
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-6">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-white/80 text-sm font-medium">PRICING PLANS</span>
            </div>

            {title && (
              <h2 className="text-5xl md:text-7xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-6 leading-tight">
                {title}
              </h2>
            )}

            {subtitle && <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">{subtitle}</p>}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="text-white/60 text-lg">Loading pricing plans...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-4">Failed to load pricing plans</p>
              <p className="text-white/40 text-sm">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        {!isLoading && !error && plans.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <PlanCard
                key={plan.mongoPlanId || index}
                name={plan.name}
                description={plan.description}
                originalPrice={plan.originalPrice}
                price={plan.price}
                savePercentage={plan.savePercentage}
                term={plan.term}
                bonusOffer={plan.bonusOffer}
                renewalPrice={plan.renewalPrice}
                renewalTerm={plan.renewalTerm}
                features={plan.features}
                isPopular={plan.isPopular}
                buttonText={plan.buttonText}
                onSelect={plan.onSelect}
              />
            ))}
          </div>
        )}

        {/* No Plans State */}
        {!isLoading && !error && plans.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-white/60 text-lg">No pricing plans available</p>
              <p className="text-white/40 text-sm">Please try again later</p>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <p className="text-white/60 mb-6">Need a custom solution? We{"'"}ve got you covered.</p>
          <button className="border border-white/20 text-white hover:bg-white/10 hover:border-white/30 px-8 py-3 rounded-xl transition-all duration-300 backdrop-blur-sm">
            Contact Sales
          </button>
          
          {/* Legal Links */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
              <a href="/terms" className="hover:text-white/70 transition-colors">
                Terms & Conditions
              </a>
              <a href="/privacy" className="hover:text-white/70 transition-colors">
                Privacy Policy
              </a>
              <a href="/cancellation-refund" className="hover:text-white/70 transition-colors">
                Cancellation & Refund Policy
              </a>
            </div>
            <p className="mt-4 text-xs text-white/40 max-w-2xl mx-auto">
              By subscribing to any plan, you agree to our Terms & Conditions and acknowledge our strict no-refund policy. 
              All subscription payments are final and non-refundable.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
