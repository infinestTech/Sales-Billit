#!/bin/bash
# Quick Fix Script for Subscription 404 Error
# Run this on your VPS server

echo "🚀 Starting Subscription Fix..."
echo ""

# Change to BillitServer directory
cd /var/www/Billit/infinestServer/BillitServer || exit 1

echo "📋 Step 1: Verifying MongoDB Plans..."
node verifyPlans.js

echo ""
echo "⏸️  Press Enter to continue with seeding (if plans are missing)..."
read -r

echo "🌱 Step 2: Running Seeder..."
node vpsSeederSimple.js

echo ""
echo "🔄 Step 3: Restarting PM2 Services..."
pm2 restart all

echo ""
echo "✅ Step 4: Checking Service Status..."
pm2 status

echo ""
echo "📊 Step 5: Checking Recent Logs..."
echo ""
echo "=== Auth Server Logs ==="
pm2 logs auth-server --lines 10 --nostream

echo ""
echo "=== Billit Backend Logs ==="
pm2 logs billit-backend --lines 10 --nostream

echo ""
echo "✅ Fix completed! Please test yearly subscription flow."
echo ""
echo "🧪 To test:"
echo "   1. Login to your frontend"
echo "   2. Go to pricing page"
echo "   3. Toggle to 'Yearly' billing"
echo "   4. Click subscribe on a yearly plan"
echo "   5. Verify Razorpay checkout appears (no 404)"
