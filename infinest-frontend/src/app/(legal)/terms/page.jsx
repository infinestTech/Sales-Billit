"use client"

import Link from "next/link"
import { ArrowLeft, FileText, Shield, AlertCircle } from "lucide-react"

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Terms and Conditions</h1>
                <p className="text-gray-600">Fixel Service Management Platform</p>
              </div>
            </div>
            <Link
              href="/billit-login"
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-8">
            {/* Last Updated */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <div className="flex items-center space-x-2 text-blue-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Last updated: August 3, 2025</span>
              </div>
            </div>

            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Welcome to Fixel, a comprehensive mobile service management platform designed for mobile repair shops and service centers. These Terms and Conditions ("Terms") govern your use of our website, mobile application, and services (collectively, the "Service") operated by Fixel ("we," "us," or "our").
              </p>
              <p className="text-gray-700 leading-relaxed">
                By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access the Service.
              </p>
            </section>

            {/* Service Description */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Fixel provides a mobile device repair and service management platform that enables businesses to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Track and manage mobile device repairs and service records</li>
                <li>Generate professional bills, receipts, and invoices</li>
                <li>Manage customer and dealer relationships</li>
                <li>Track product inventory and business expenses</li>
                <li>Monitor business analytics, dashboard metrics, and performance</li>
                <li>Backup and restore business data securely</li>
                <li>Send automated notifications and WhatsApp messages</li>
                <li>Access different subscription tiers (Basic, Gold, Premium)</li>
              </ul>
            </section>

            {/* Subscription Plans */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Subscription Plans</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Fixel offers various subscription plans with different features and limitations:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li><strong>Basic Plan (Free):</strong> Limited features with entry restrictions (30 pages × 15 records), ads displayed, and basic functionality</li>
                  <li><strong>Gold Plan (₹399/month):</strong> Enhanced features with higher limits (40 pages × 15 records), dashboard access, expense tracking, and WhatsApp billing</li>
                  <li><strong>Premium Plan (₹499/month):</strong> Full-featured plan with maximum limits (60 pages × 15 records), product inventory, notifications, and ad-free experience</li>
                </ul>
              </div>
            </section>

            {/* Payment Terms with No Refund Policy */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Payment Terms & No Refund Policy</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-semibold mb-2">⚠️ IMPORTANT: STRICT NO REFUND POLICY</p>
                <p className="text-red-700">
                  All payments made for subscription plans are final and non-refundable. No cancellations, refunds, or chargebacks will be entertained under any circumstances, including but not limited to service dissatisfaction, technical issues, or business closure.
                </p>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Payment processing is handled through secure third-party payment gateways including Razorpay. By making a payment, you agree to their terms and conditions as well.
              </p>
            </section>

            {/* User Responsibilities */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. User Responsibilities</h2>
              <p className="text-gray-700 leading-relaxed mb-4">You agree to use the service responsibly and comply with all applicable laws and regulations.</p>
            </section>

            {/* Data Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data and Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. Please refer to our Privacy Policy for detailed information about how we collect, use, and protect your data.
              </p>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about these Terms and Conditions, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700"><strong>Email:</strong> infinest.tech@gmail.com</p>
                <p className="text-gray-700"><strong>Phone:</strong> +91 9600925488</p>
                <p className="text-gray-700"><strong>Address:</strong> Infinest Tech, India</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/privacy"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span>Privacy Policy</span>
          </Link>
          <Link
            href="/cancellation-refund"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>Cancellation & Refund</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
