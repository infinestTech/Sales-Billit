"use client"

import Link from "next/link"
import { ArrowLeft, XCircle, AlertTriangle, CreditCard, FileText, Clock } from "lucide-react"

export default function CancellationRefund() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cancellation & Refund Policy</h1>
                <p className="text-gray-600">Fixel Service Management Platform</p>
              </div>
            </div>
            <Link
              href="/billit-login"
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Last updated: August 3, 2025</span>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-8">
              <div className="flex items-start">
                <AlertTriangle className="h-6 w-6 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ IMPORTANT NOTICE</h3>
                  <p className="text-red-700 font-medium">
                    Fixel operates under a STRICT NO REFUND POLICY. All subscription payments are final and non-refundable under any circumstances.
                  </p>
                </div>
              </div>
            </div>

            {/* No Refund Policy */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <XCircle className="h-6 w-6 mr-2 text-red-600" />
                1. No Refund Policy
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-red-800 mb-3">ZERO TOLERANCE REFUND POLICY</h3>
                <p className="text-red-700 leading-relaxed mb-4">
                  <strong>NO REFUNDS, NO EXCEPTIONS:</strong> All payments made for Fixel subscription plans (Basic, Gold, Premium) are absolutely final and non-refundable. This policy applies to all circumstances without exception, including but not limited to:
                </p>
                <ul className="list-disc list-inside text-red-700 space-y-2 ml-4">
                  <li>Service dissatisfaction or unmet expectations</li>
                  <li>Technical issues or platform downtime</li>
                  <li>Business closure or change in business needs</li>
                  <li>Accidental purchases or duplicate payments</li>
                  <li>Feature limitations or subscription plan misunderstandings</li>
                  <li>Account suspension or termination by Fixel</li>
                  <li>Third-party payment gateway issues</li>
                  <li>Personal financial difficulties</li>
                  <li>Change of mind after purchase</li>
                  <li>Force majeure events or natural disasters</li>
                </ul>
              </div>
              <p className="text-gray-700 leading-relaxed">
                By proceeding with any payment, you explicitly acknowledge and agree to this strict no-refund policy.
              </p>
            </section>

            {/* Subscription Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <CreditCard className="h-6 w-6 mr-2 text-red-600" />
                2. Subscription Terms
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Monthly Subscriptions</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li><strong>Gold Plan:</strong> ₹399 per month - No partial refunds for unused periods</li>
                    <li><strong>Premium Plan:</strong> ₹499 per month - No partial refunds for unused periods</li>
                    <li>Subscriptions are billed monthly in advance</li>
                    <li>Service continues until the end of the paid period, then expires</li>
                  </ul>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Free Basic Plan</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>Always free with limited features and advertisements</li>
                    <li>No payment required, no refund applicable</li>
                    <li>Can be used indefinitely with feature restrictions</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* No Cancellation */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Clock className="h-6 w-6 mr-2 text-red-600" />
                3. No Mid-Cycle Cancellations
              </h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-800 font-medium mb-2">
                  <strong>Important:</strong> Paid subscriptions cannot be cancelled mid-cycle.
                </p>
                <p className="text-orange-700 leading-relaxed">
                  Once you purchase a monthly subscription, you will have access to the paid features until the end of that billing period. The subscription will automatically expire at the end of the month, and you can choose whether to renew or continue with the free Basic plan.
                </p>
              </div>
            </section>

            {/* Before You Subscribe */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Before You Subscribe</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">
                  <strong>Try Before You Buy:</strong>
                </p>
                <p className="text-blue-700 leading-relaxed mb-3">
                  We strongly recommend thoroughly testing our free Basic plan before upgrading to paid subscriptions:
                </p>
                <ul className="list-disc list-inside text-blue-700 space-y-1 ml-4">
                  <li>Test all core functionalities with the Basic plan</li>
                  <li>Evaluate if the platform meets your business needs</li>
                  <li>Review feature limitations and paid plan benefits</li>
                  <li>Contact support if you have questions about features</li>
                  <li>Read our Terms & Conditions and Privacy Policy carefully</li>
                </ul>
              </div>
            </section>

            {/* Legal Compliance */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Legal Compliance</h2>
              <p className="text-gray-700 leading-relaxed">
                This no-refund policy is enforceable under Indian law and is consistent with digital service industry standards. By using our platform and making any payment, you agree to be bound by this policy and waive any right to dispute charges or demand refunds through any means.
              </p>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                For questions about this policy or our services (not refund requests):
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700"><strong>Email:</strong> infinest.tech@gmail.com</p>
                <p className="text-gray-700"><strong>Phone:</strong> +91 9600925488</p>
                <p className="text-gray-700"><strong>Address:</strong> Infinest Tech, India</p>
                <p className="text-red-600 font-medium mt-2">
                  <strong>Note:</strong> Refund requests will not be entertained through any communication channel.
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/terms"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>Terms & Conditions</span>
          </Link>
          <Link
            href="/privacy"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>Privacy Policy</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
