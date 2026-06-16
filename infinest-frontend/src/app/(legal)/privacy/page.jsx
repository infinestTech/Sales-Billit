"use client"

import Link from "next/link"
import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck } from "lucide-react"

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
                <p className="text-gray-600">Fixel Service Management Platform</p>
              </div>
            </div>
            <Link
              href="/billit-login"
              className="flex items-center space-x-2 text-green-600 hover:text-green-700 transition-colors"
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
              <div className="flex items-center space-x-2 text-green-700">
                <Eye className="h-5 w-5" />
                <span className="font-semibold">Last updated: August 3, 2025</span>
              </div>
            </div>

            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                At Fixel ("we," "our," or "us"), we are committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile service management platform designed for repair shops and service centers.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using our Service, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <UserCheck className="h-5 w-5 mr-2 text-green-600" />
                  Personal Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-2">When you register for an account, we collect:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Full name and email address</li>
                  <li>Phone number for account verification</li>
                  <li>Shop/business name and details</li>
                  <li>Password (encrypted and securely stored)</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-green-600" />
                  Business Data
                </h3>
                <p className="text-gray-700 leading-relaxed mb-2">As you use our platform, we store:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Mobile device repair records and service history</li>
                  <li>Customer information (names, phone numbers, device details)</li>
                  <li>Dealer and supplier contact information</li>
                  <li>Product inventory data and expense records</li>
                  <li>Financial information (billing amounts, payment records)</li>
                  <li>Generated receipts, invoices, and reports</li>
                  <li>Backup and restore data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Lock className="h-5 w-5 mr-2 text-green-600" />
                  Technical Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-2">We automatically collect:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>IP address and browser information</li>
                  <li>Device type and operating system</li>
                  <li>Usage patterns and feature interactions</li>
                  <li>Login timestamps and session data</li>
                  <li>Error logs and performance metrics</li>
                </ul>
              </div>
            </section>

            {/* How We Use Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">We use the collected information to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Provide and maintain our service management platform</li>
                <li>Process your subscription payments and manage billing</li>
                <li>Send important notifications about your account and subscriptions</li>
                <li>Generate business reports and analytics for your shop</li>
                <li>Provide customer support and technical assistance</li>
                <li>Improve our platform features and user experience</li>
                <li>Send WhatsApp notifications (with your consent)</li>
                <li>Backup and restore your business data securely</li>
                <li>Comply with legal obligations and prevent fraud</li>
              </ul>
            </section>

            {/* Information Sharing */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li><strong>Service Providers:</strong> With trusted third-party services like Razorpay for payment processing</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulations</li>
                <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of our business</li>
                <li><strong>Consent:</strong> When you explicitly agree to share information with specific parties</li>
              </ul>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement robust security measures to protect your information:
              </p>
              <div className="bg-green-50 rounded-lg p-4">
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>SSL/TLS encryption for data transmission</li>
                  <li>Secure password hashing and storage</li>
                  <li>Regular security audits and updates</li>
                  <li>Access controls and authentication protocols</li>
                  <li>Automated backup systems with encryption</li>
                  <li>Monitoring for unauthorized access attempts</li>
                </ul>
              </div>
            </section>

            {/* Data Retention */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide services. After account termination, we may retain certain information for legal compliance, fraud prevention, and business records for a period not exceeding 7 years.
              </p>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Access and download your business data</li>
                <li>Update or correct your account information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of promotional communications</li>
                <li>Request data portability and export</li>
                <li>Withdraw consent for data processing (where applicable)</li>
              </ul>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
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
            href="/terms"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span>Terms & Conditions</span>
          </Link>
          <Link
            href="/cancellation-refund"
            className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Lock className="h-4 w-4" />
            <span>Cancellation & Refund</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
