import "../globals.css";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAInstaller from "@/components/PWAInstaller";

export const metadata = {
  title: {
    template: '%s | Fixel - Smart Mobile Service Management',
    default: 'Fixel - Professional Mobile Service Management System | Track, Bill & Manage Efficiently'
  },
  description: 'Fixel is a comprehensive mobile service management platform designed for repair shops, service centers, and dealers. Track mobile repairs, manage inventory, generate bills, and boost your business efficiency with our smart workflow tools.',
  keywords: [
    'mobile service management',
    'repair shop software',
    'mobile repair tracking',
    'service center management',
    'billing software',
    'inventory management',
    'business automation',
    'mobile repair CRM',
    'service tracking system',
    'repair shop billing',
    'mobile service CRM',
    'workshop management',
    'technical service software',
    'repair business tools',
    'mobile phone repair',
    'service management platform'
  ],
  authors: [{ name: 'Fixel Team' }],
  creator: 'Fixel',
  publisher: 'Fixel',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: 'Business Software',
  classification: 'Business Management Software',
  metadataBase: new URL(process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Fixel - Professional Mobile Service Management System',
    description: 'Transform your mobile repair business with Fixel. Track repairs, manage inventory, generate professional bills, and streamline your workflow. Perfect for service centers, repair shops, and mobile dealers.',
    siteName: 'Fixel',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Fixel - Mobile Service Management Platform',
        type: 'image/jpeg',
      },
      {
        url: '/images/og-image-square.jpg',
        width: 600,
        height: 600,
        alt: 'Fixel Logo',
        type: 'image/jpeg',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fixel - Professional Mobile Service Management',
    description: 'Streamline your mobile repair business with smart tracking, billing, and inventory management. Try Fixel today!',
    creator: '@FixelApp',
    site: '@FixelApp',
    images: ['/images/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  other: {
    'application-name': 'Fixel',
    'apple-mobile-web-app-title': 'Fixel',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'mobile-web-app-capable': 'yes',
    'theme-color': '#3b82f6',
    'color-scheme': 'light dark',
    'format-detection': 'telephone=no',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Favicon and App Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Additional Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        
        {/* Performance and Security */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "BillIt",
              "applicationCategory": "BusinessApplication",
              "applicationSubCategory": "Service Management",
              "operatingSystem": "Web Browser",
              "description": "Professional mobile service management platform for repair shops and service centers",
              "url": process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
              "author": {
                "@type": "Organization",
                "name": "BillIt Team"
              },
              "offers": {
                "@type": "Offer",
                "priceCurrency": "INR",
                "price": "0",
                "description": "Free tier available with premium subscriptions"
              },
              "featureList": [
                "Mobile repair tracking",
                "Inventory management", 
                "Professional billing",
                "Customer management",
                "Business analytics",
                "Multi-platform support"
              ]
            })
          }}
        />
      </head>
      <body className="bg-black text-white min-h-screen">
        <PWAInstaller />
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
