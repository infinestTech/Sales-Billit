"use client"

import { useState } from "react"
import { Check, Shield, Sparkles, Layers, X } from "lucide-react"

const planIcons = {
  Basic: Shield,
  Trial: Shield,
  Premium: Sparkles,
  Combo: Layers,
}

export default function PlanCard({
  name,
  description,
  originalPrice,
  price,
  savePercentage,
  term = "48-month term",
  bonusOffer = "+2 months free",
  renewalPrice,
  renewalTerm = "a year",
  features = [],
  isPopular = false,
  buttonText = "Choose plan",
  onSelect,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const IconComponent = planIcons[name] || Shield

  return (
    <div
      className={`relative transition-all duration-500 ${isPopular ? "md:-translate-y-4" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-gradient-to-r from-white to-white/80 text-black font-semibold px-4 py-1 text-sm rounded-full">
            MOST POPULAR
          </div>
        </div>
      )}

      <div
        className={`
          relative h-full p-8 rounded-3xl border transition-all duration-500 backdrop-blur-xl
          ${
            isPopular
              ? "bg-gradient-to-b from-white/10 to-white/5 border-white/20 shadow-2xl shadow-white/10"
              : "bg-gradient-to-b from-white/5 to-transparent border-white/10 hover:border-white/20"
          }
          ${isHovered ? "scale-105 shadow-2xl shadow-white/20" : ""}
        `}
      >
        <div
          className={`
            absolute inset-0 rounded-3xl transition-opacity duration-500
            ${isHovered ? "opacity-100" : "opacity-0"}
            bg-gradient-to-b from-white/5 to-transparent
          `}
        />
        <div className="relative z-10">
          {/* Plan Header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`p-3 rounded-2xl ${
                isPopular
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white"
              }`}
            >
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">{name}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-white/40 line-through text-sm">INR₹ {originalPrice}</span>
              <div className="bg-white/10 text-white/90 px-3 py-1 rounded-full text-xs font-semibold border border-white/20">
                SAVE {savePercentage}%
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-white/60 text-lg">INR₹</span>
              <span className="text-5xl font-bold text-white">{price}</span>
              <span className="text-white/60 text-lg">/mo</span>
            </div>
            <p className="text-white/60 text-sm mb-2">For {term}</p>

            {bonusOffer && (
              <div className="inline-block bg-white/10 text-white/90 px-3 py-1 rounded-full text-sm font-medium border border-white/20">
                {bonusOffer}
              </div>
            )}
          </div>

          {/* Choose Plan Button */}
          <div className="mb-8">
            <button
              onClick={onSelect}
              disabled={buttonText.includes("Processing")}
              className={`
                w-full py-4 px-6 rounded-2xl font-semibold transition-all duration-300 text-base
                ${
                  isPopular
                    ? "bg-white text-black hover:bg-white/90 shadow-lg shadow-white/20"
                    : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30"
                }
                ${buttonText.includes("Processing") ? "opacity-50 cursor-not-allowed" : ""}
                ${isHovered && !buttonText.includes("Processing") ? "scale-105" : ""}
              `}
            >
              {buttonText.includes("Processing") && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 inline-block" />
              )}
              {buttonText}
            </button>
          </div>

          {/* Renewal Info */}
          <div className="mb-8 pb-6 border-b border-white/10">
            <p className="text-white/50 text-xs">
              Renews at INR₹ {renewalPrice}/mo for {renewalTerm}. Cancel anytime.
            </p>
          </div>

          {/* Features List (structured) */}
          <div className="space-y-4">
            {features.map((feature, index) => {
              const isDisabled = feature?.value === false
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    isDisabled ? "opacity-50 line-through" : ""
                  }`}
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                    {isDisabled ? (
                      <X className="w-3 h-3 text-white/50" />
                    ) : (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-white/80 text-sm leading-relaxed">{feature.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
