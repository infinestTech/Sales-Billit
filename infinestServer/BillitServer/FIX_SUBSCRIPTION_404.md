# Fix for Subscription 404 Error

## Problem Summary
When subscribing to yearly plans (sales-premium-yearly, service-premium-yearly, combo-premium-yearly), the backend returns a 404 error with message "Failed to fetch plan details".

## Root Cause
1. **Environment Variable Mismatch**: The seeder script (`vpsSeederSimple.js`) was using `process.env.MONGO_URI`, but the `.env` file only defined `BILLIT_MONGO_URI`
2. **Missing Plans in MongoDB**: Yearly plans were not seeded into the MongoDB database
3. **Trust Proxy Not Configured**: Auth server was not configured to trust the reverse proxy, causing rate limiter warnings

## Fixes Applied

### 1. Fixed Seeder Script
- Updated `vpsSeederSimple.js` to check for `BILLIT_MONGO_URI` first, then fall back to `MONGO_URI`
- This ensures the seeder uses the correct environment variable

### 2. Added MONGO_URI to .env
- Added `MONGO_URI` variable to `.env` file for backward compatibility

### 3. Fixed Trust Proxy Warning
- Added `app.set('trust proxy', true)` to auth server to correctly detect client IPs behind nginx

## Steps to Fix on VPS

### Step 1: Update Code on VPS
```bash
# SSH into your VPS
ssh root@ubuntu-4gb-fsn1-1

# Navigate to project directory
cd /var/www/Billit

# Pull latest changes (if using git)
git pull

# Or manually update the files:
# - infinestServer/BillitServer/vpsSeederSimple.js
# - infinestServer/CommonDB/server_auth.js
# - infinestServer/BillitServer/.env (add MONGO_URI line)
```

### Step 2: Verify MongoDB Plans
```bash
# Navigate to BillitServer directory
cd /var/www/Billit/infinestServer/BillitServer

# Run verification script
node verifyPlans.js
```

**Expected Output:**
```
✅ Found: sales-premium-yearly
✅ Found: service-premium-yearly
✅ Found: combo-premium-yearly
📊 Total plans in database: 12
```

### Step 3: If Plans are Missing - Run Seeder
```bash
# Still in BillitServer directory
node vpsSeederSimple.js
```

**Expected Output:**
```
🚀 Starting VPS Database Seeding...
✅ Connected to production MongoDB
📂 Seeding Plan Categories...
📋 Seeding Plans...
✅ [INSERTED/UPDATED] plan: Sales/Premium Yearly - ₹4990
✅ [INSERTED/UPDATED] plan: Service/Premium Yearly - ₹4990
✅ [INSERTED/UPDATED] plan: Sales_Service/Combo Yearly - ₹8990
```

### Step 4: Restart Services
```bash
# Restart all PM2 services to apply changes
pm2 restart all

# Verify services are running
pm2 status

# Check logs for any errors
pm2 logs auth-server --lines 20
pm2 logs billit-backend --lines 20
```

### Step 5: Verify the Fix
```bash
# Check auth-server logs - trust proxy warning should be gone
pm2 logs auth-server --lines 20

# The ValidationError about X-Forwarded-For should no longer appear
```

## Testing the Subscription

1. Log into your frontend application
2. Navigate to the pricing page (Sales/Service/Combo)
3. Toggle to "Yearly" billing period
4. Click "Subscribe" on a yearly plan
5. The Razorpay checkout should appear (no 404 error)

## Verification Checklist

- [ ] Code updated on VPS (vpsSeederSimple.js, server_auth.js, .env)
- [ ] `node verifyPlans.js` shows all 12 plans exist
- [ ] PM2 services restarted successfully
- [ ] Trust proxy warning no longer appears in auth-server logs
- [ ] Yearly subscription flow works without 404 error

## Quick Verification Commands

```bash
# Check if plans exist in MongoDB
mongosh mongodb://127.0.0.1:27017/billit_db --eval "db.plans.find({ _id: { \$in: ['sales-premium-yearly', 'service-premium-yearly', 'combo-premium-yearly'] } }).count()"

# Expected output: 3

# Check all plans count
mongosh mongodb://127.0.0.1:27017/billit_db --eval "db.plans.countDocuments()"

# Expected output: 12
```

## Environment Variables to Verify

In `/var/www/Billit/infinestServer/BillitServer/.env`:
```bash
BILLIT_MONGO_URI="mongodb://127.0.0.1:27017/billit_db"
MONGO_URI="mongodb://127.0.0.1:27017/billit_db"
```

## Troubleshooting

### If plans still not found after seeding:
```bash
# Check MongoDB connection
mongosh mongodb://127.0.0.1:27017/billit_db --eval "db.adminCommand('ping')"

# List all plans
mongosh mongodb://127.0.0.1:27017/billit_db --eval "db.plans.find().pretty()"
```

### If services fail to restart:
```bash
# Check PM2 logs for errors
pm2 logs --err

# Restart individual service
pm2 restart auth-server
pm2 restart billit-backend
```

### If 404 error persists:
```bash
# Check billit-backend logs for the exact error
pm2 logs billit-backend --lines 50

# Verify BILLIT_BACKEND_URL is correct in BillitServer/.env
cat /var/www/Billit/infinestServer/BillitServer/.env | grep BILLIT_BACKEND_URL
```

## Changes Made

### Files Modified:
1. `infinestServer/BillitServer/vpsSeederSimple.js` - Fixed MONGO_URI to check BILLIT_MONGO_URI first
2. `infinestServer/CommonDB/server_auth.js` - Added trust proxy setting
3. `infinestServer/BillitServer/.env` - Added MONGO_URI variable

### Files Created:
1. `infinestServer/BillitServer/verifyPlans.js` - Plan verification utility
2. `infinestServer/BillitServer/FIX_SUBSCRIPTION_404.md` - This documentation
