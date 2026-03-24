require('dotenv').config();
console.log('🔸 Starting Sales server script... PID=', process.pid);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios').create({ family: 4, timeout: 10000 });
const jwt = require('jsonwebtoken');
const Shop = require('./models/shop');
const supplierRoutes = require('./routes/supplierRoutes');
const inStockRoutes = require('./routes/inStockRoutes');
const branchRoutes = require('./routes/branchRoutes');
const branchSupplyRoutes = require('./routes/branchSupplyRoutes');
const branchExpenseRoutes = require('./routes/branchExpenseRoutes');
const saleRoutes = require('./routes/saleRoutes');
const whatsappContactRoutes = require('./routes/whatsappContactRoutes');
const whatsappStockRoutes = require('./routes/whatsappStockRoutes');
const whatsappSaleRoutes = require('./routes/whatsappSaleRoutes');
const mysqlUserRoutes = require('./routes/mysqlUserRoutes');
const secondsSalesRoutes = require('./routes/secondsSalesRoutes');
const featureRoutes = require('./routes/featureRoutes');
const supplierCreditRoutes = require('./routes/supplierCreditRoutes');

const { syncSalesUser } = require('./controllers/salesSyncController');
const app = express();
// Increase JSON payload limit to allow base64 file uploads from the frontend.
// This is a temporary measure; for production prefer multipart uploads (multer) or direct S3 uploads.
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: process.env.EXPRESS_URLENCODED_LIMIT || '50mb', extended: true }));

// Serve uploaded files (images/documents/signatures)
const uploadsDir = path.resolve(__dirname, 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
app.use('/uploads', express.static(uploadsDir));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.AUTH_SERVER_URL || 'http://localhost:7000',
    'http://localhost:3020',
    'http://127.0.0.1:3020',
    // Production domains
    'https://sales.infinestech.com',    // ✅ Production sales frontend
    'http://sales.infinestech.com',     // ✅ Fallback for sales frontend
    'https://auth.infinestech.com',     // ✅ Production auth server
    'http://auth.infinestech.com',      // ✅ Fallback for auth server
    // Local development
    'http://localhost:7000',            // ✅ Local auth server
    'http://127.0.0.1:7000',
    'http://[::1]:7000'                 // ✅ IPv6 localhost
  ],
  credentials: true,
}));

// Mongo connection (reuse BILLIT_MONGO_URI as requested)
const MONGO_URI = process.env.BILLIT_MONGO_URI || 'mongodb://127.0.0.1:27017/billit_db';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Sales Mongo Connected')).catch(e => console.error('❌ Sales Mongo error:', e.message));

// Models are defined in ./models to avoid redefinition

app.get('/health', (req, res) => res.json({ ok: true }));

// DEV DEBUG: inspect a branch record by email (dev-only helper)
// Usage: GET /debug/branch?email=branch@example.com
app.get('/debug/branch', async (req, res) => {
  try {
    const Branch = require('./models/branch');
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'email query required' });
    const branch = await Branch.findOne({ email }).lean();
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    // Return only non-sensitive fields and a short hash preview for debugging
    return res.json({
      email: branch.email,
      shop_id: branch.shop_id,
      name: branch.name,
      isAdmin: !!branch.isAdmin,
      passwordHashPrefix: (branch.passwordHash || '').slice(0, 12)
    });
  } catch (err) {
    console.error('/debug/branch error:', err && err.message || err);
    return res.status(500).json({ message: 'Server error' });
  }
  // GST-only in-stock API endpoint for frontend
  const InStock = require('./models/inStock');
  const Supplier = require('./models/supplier');

  app.get('/api/in-stock', async (req, res) => {
    try {
      // Only GST entries if gstOnly=1
      const gstOnly = req.query.gstOnly === '1';
      const query = gstOnly ? { gstAmount: { $gt: 0 } } : {};
      // Populate supplier info
      const entries = await InStock.find(query)
        .populate('supplier_id', 'supplierName agencyName')
        .sort({ createdAt: -1 })
        .lean();
      res.json({ entries });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch in-stock GST entries.' });
    }
  });
});

// Branch login: allow branch-level sign-in using branch email + password
app.post('/auth/branch-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const Branch = require('./models/branch');
    const crypto = require('crypto');

    const normalizedEmail = (email || '').toLowerCase().trim();
    console.log('➡️ Branch login attempt for:', normalizedEmail);

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // Find ALL branches with this email (multiple shops may have branches with
    // the same email). Sort newest-first so the most recently created branch wins
    // when credentials match multiple branches.
    const candidates = await Branch.find({ email: normalizedEmail }).sort({ _id: -1 }).lean();
    if (!candidates.length) {
      console.log('⬇️ Branch not found for:', normalizedEmail);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const branch = candidates.find(b => b.passwordHash === hash);
    if (!branch) {
      console.log('❌ Password hash mismatch for:', normalizedEmail);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Issue a branch-scoped token (shorter expiry)
    const payload = {
      branch_id: String(branch._id),
      shop_id: branch.shop_id,
      name: branch.name,
      isAdmin: !!branch.isAdmin
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-sales-secret', { expiresIn: '2h' });

    return res.json({ success: true, message: 'Branch login successful', token, payload });
  } catch (err) {
    console.error('Branch login error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper: fetch branchLimit from MongoDB Feature model
async function fetchBranchLimitByMongoPlanId(mongoPlanId) {
  try {
    const { Feature } = require('./models/feature');
    console.log('🔍 Fetching branch_limit from MongoDB Feature model...');
    const feature = await Feature.findOne({ 
      plan_id: 'sales-premium',
      feature_key: 'branch_limit' 
    });
    
    console.log('📊 Branch limit feature found:', feature);
    
    if (feature?.config?.maxBranches) {
      console.log('✅ Returning branch limit:', feature.config.maxBranches);
      return feature.config.maxBranches;
    }
    console.warn('⚠️ No branch limit found in feature, using fallback: 5');
    return 5; // Fallback
  } catch (err) {
    console.error('❌ Error fetching branch limit:', err.message);
    return 5;
  }
}

// Sales auth: login using CommonDB and issue a JWT with userId, mongoPlanId, shop_id
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    // Login against CommonDB
    const loginRes = await axios.post(`${process.env.AUTH_SERVER_URL}/login`, { email, password });
    const token = loginRes.data?.token;
    if (!token) return res.status(401).json({ message: 'Invalid credentials' });

    // Verify token to get MySQL userId (and profile if available)
    const verifyRes = await axios.post(`${process.env.AUTH_SERVER_URL}/internal-verify-token`, {}, {
      headers: { Authorization: `Bearer ${token}`, 'x-internal-key': process.env.INTERNAL_API_KEY }
    });
    if (!verifyRes.data?.valid) return res.status(401).json({ message: 'Invalid token' });
    const userId = verifyRes.data.user.userId;

    // Check SALES access to get sales-specific mongoPlanId
    console.log('🔍 Checking SALES access for user:', userId);
    const accessRes = await axios.post(`${process.env.AUTH_SERVER_URL}/get-user-sales-access`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const hasAccess = !!accessRes.data?.hasAccess;
    if (!hasAccess) {
      return res.status(403).json({ message: 'No active SALES subscription for this user' });
    }
    
    // Get the plan from the access check
    const mongoPlanId = accessRes.data?.mongoPlanId || null;
    
    // Ensure user has a valid sales plan or combo plan
    if (!mongoPlanId || (!mongoPlanId.startsWith('sales-') && !mongoPlanId.startsWith('combo-'))) {
      return res.status(403).json({ 
        message: 'Sales app access requires a sales plan subscription. Please subscribe to a sales plan to access this application.' 
      });
    }

    // ✅ Check if trial has expired for Basic plan users
    if (mongoPlanId === 'sales-basic') {
      try {
        const trialRes = await axios.get(
          `${process.env.AUTH_SERVER_URL}/internal-get-trial-status/${userId}`,
          {
            headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }
          }
        );
        
        if (trialRes.data && !trialRes.data.isActive) {
          console.log('❌ Trial has expired for user:', userId);
          return res.status(403).json({ 
            message: "Your trial plan has ended. Please subscribe to Premium to continue enjoying Fixel Sales' amazing features!",
            trialExpired: true,
            redirectToPricing: true
          });
        }
      } catch (trialErr) {
        console.warn('⚠️ Could not verify trial status:', trialErr.message);
        // If we can't verify trial, block access for Trial plan users
        return res.status(403).json({ 
          message: "Unable to verify trial status. Please subscribe to Premium to continue.",
          trialExpired: true,
          redirectToPricing: true
        });
      }
    }

    // Find or create a Shop by mysql_user_id
    let shop = await Shop.findOne({ mysql_user_id: userId });
    if (!shop) {
      shop = await Shop.create({ mysql_user_id: userId });
    }

    // Enrich Shop with user details if available
    try {
      const profile = verifyRes.data?.user || {};
      const patch = {};
      if (profile.name) patch.owner_name = profile.name;
      if (profile.email) patch.email = profile.email;
      if (profile.phone) patch.phone = profile.phone;
      if (Object.keys(patch).length) {
        await Shop.updateOne({ _id: shop._id }, { $set: patch });
      }
    } catch {}

    // Get branchLimit for the plan from CommonDB
  const branchLimit = await fetchBranchLimitByMongoPlanId(mongoPlanId);
  console.log('➡️ /auth/login resolved branchLimit for mongoPlanId', mongoPlanId, '=>', branchLimit);

    const payload = {
      userId,               // MySQL user ID
      mongoPlanId,          // e.g., 'sales-premium'
      shop_id: String(shop._id),
      branchLimit: Number.isFinite(branchLimit) ? branchLimit : 0
    };

    const signed = jwt.sign(payload, process.env.JWT_SECRET || 'dev-sales-secret', {
      expiresIn: '7d',
      issuer: process.env.JWT_ISSUER || 'sales.local'
    });

    res.json({ message: 'Login successful', token: signed, payload });
  } catch (err) {
    console.error('Sales /auth/login error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Login failed', error: err.response?.data || err.message });
  }
});

// Get current plan limits from Feature model
app.get('/api/plan-limits', async (req, res) => {
  try {
    const { Feature } = require('./models/feature');
    
    const features = await Feature.find({
      plan_id: 'sales-premium',
      feature_key: { $in: ['branch_limit', 'supplier_limit', 'product_inventory_limit'] }
    });
    
    const limits = {};
    features.forEach(f => {
      if (f.feature_key === 'branch_limit') limits.branches = f.config?.maxBranches || 5;
      if (f.feature_key === 'supplier_limit') limits.suppliers = f.config?.maxSuppliers || 10;
      if (f.feature_key === 'product_inventory_limit') limits.products = f.config?.maxProducts || 150;
    });
    
    res.json({ limits });
  } catch (err) {
    console.error('Error fetching plan limits:', err.message);
    res.status(500).json({ message: 'Failed to fetch limits', error: err.message });
  }
});

// Verify the Sales JWT
app.get('/auth/verify', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const raw = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!raw) return res.status(400).json({ valid: false, message: 'Token missing' });

    // Try to verify as a Sales token first
    try {
      const decoded = jwt.verify(raw, process.env.JWT_SECRET || 'dev-sales-secret');
      return res.json({ valid: true, decoded });
    } catch (_) {
      // Fall through to CommonDB verification
    }

    // Validate token with CommonDB
    const verifyRes = await axios.post(`${process.env.AUTH_SERVER_URL}/internal-verify-token`, {}, {
      headers: { Authorization: `Bearer ${raw}`, 'x-internal-key': process.env.INTERNAL_API_KEY }
    });
    if (!verifyRes.data?.valid) return res.status(401).json({ valid: false, message: 'Invalid token' });
    const userId = verifyRes.data.user.userId;

    // Ensure SALES access
    const accessRes = await axios.post(`${process.env.AUTH_SERVER_URL}/get-user-sales-access`, {}, {
      headers: { Authorization: `Bearer ${raw}` }
    });
    if (!accessRes.data?.hasAccess) {
      return res.status(403).json({ valid: false, message: 'No active SALES subscription' });
    }

    // Resolve or create shop
    let shop = await Shop.findOne({ mysql_user_id: userId });
    if (!shop) shop = await Shop.create({ mysql_user_id: userId });

    // Enrich Shop with user details if available
    try {
      const profile = verifyRes.data?.user || {};
      const patch = {};
      if (profile.name) patch.owner_name = profile.name;
      if (profile.email) patch.email = profile.email;
      if (profile.phone) patch.phone = profile.phone;
      if (Object.keys(patch).length) {
        await Shop.updateOne({ _id: shop._id }, { $set: patch });
      }
    } catch {}

    const mongoPlanId = accessRes.data?.mongoPlanId || null;
  const branchLimit = await fetchBranchLimitByMongoPlanId(mongoPlanId);
  console.log('➡️ /auth/verify resolved branchLimit for mongoPlanId', mongoPlanId, '=>', branchLimit);

    // Reissue a proper Sales token
    const payload = {
      userId,
      mongoPlanId,
      shop_id: String(shop._id),
      branchLimit: Number.isFinite(branchLimit) ? branchLimit : 0
    };
    const signed = jwt.sign(payload, process.env.JWT_SECRET || 'dev-sales-secret', {
      expiresIn: '7d',
      issuer: process.env.JWT_ISSUER || 'sales.local'
    });
    return res.json({ valid: true, token: signed, payload });
  } catch (err) {
    console.error('Sales /auth/verify error:', err.response?.data || err.message);
    res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

// Subscribe endpoint: records MySQL subscription via CommonDB and mirrors to Mongo
app.post('/api/subscribe', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });

    const { mongoPlanId, mongoCategoryId, amount = 0 } = req.body;
    if (!mongoPlanId || !mongoCategoryId) {
      return res.status(400).json({ message: 'mongoPlanId and mongoCategoryId are required' });
    }

    // Verify token and get user via CommonDB
    const verify = await axios.post(`${process.env.AUTH_SERVER_URL}/internal-verify-token`, {}, {
      headers: { Authorization: `Bearer ${token}`, 'x-internal-key': process.env.INTERNAL_API_KEY }
    });
    if (!verify.data?.valid) return res.status(403).json({ message: 'Invalid token' });
    const userId = verify.data.user.userId;

    // Create subscription in MySQL as SALES product
    const subUrl = amount === 0 ? '/mysql-subscribe-free' : '/mysql-subscribe';
    const payload = amount === 0
      ? { mongoPlanId, mongoCategoryId, amount: 0, product: 'SALES' }
      : { mongoPlanId, mongoCategoryId, amount, product: 'SALES' };

    const mysqlRes = await axios.post(`${process.env.AUTH_SERVER_URL}${subUrl}`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Pull branchLimit for this plan to store/return
    const branchLimit = await fetchBranchLimitByMongoPlanId(mongoPlanId);

    // Mirror to Mongo for SALES namespace using controller
    await syncSalesUser(userId, `Bearer ${token}`);

    // Also try to enrich Shop with user profile (name/email/phone)
    try {
      const profile = verify.data?.user || {};
      const shop = await Shop.findOne({ mysql_user_id: userId }) || await Shop.create({ mysql_user_id: userId });
      const patch = {};
      if (profile.name) patch.owner_name = profile.name;
      if (profile.email) patch.email = profile.email;
      if (profile.phone) patch.phone = profile.phone;
      if (Object.keys(patch).length) {
        await Shop.updateOne({ _id: shop._id }, { $set: patch });
      }
    } catch {}

    return res.json({
      success: true,
      mysql: mysqlRes.data,
      plan: { mongoPlanId, branchLimit: Number.isFinite(branchLimit) ? branchLimit : 0 }
    });
  } catch (err) {
    console.error('❌ Sales subscribe error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Mount feature routes
app.use(supplierRoutes);
app.use(inStockRoutes);
app.use(branchRoutes);
app.use(branchSupplyRoutes);
app.use(branchExpenseRoutes);
app.use(saleRoutes);
app.use(whatsappContactRoutes);
app.use(whatsappStockRoutes);
app.use(whatsappSaleRoutes);
app.use(mysqlUserRoutes);
app.use(secondsSalesRoutes);
app.use(featureRoutes);
app.use(supplierCreditRoutes);

const PORT = process.env.SALES_PORT || 9000;
app.listen(PORT, '0.0.0.0', function () {
  console.log(`🚀 Sales Server on ${PORT} (pid=${process.pid})`);
});
console.log('🔹 server_sales.js module setup complete');
