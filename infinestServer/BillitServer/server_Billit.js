require('dotenv').config(); // ✅ Load env variables
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const apiRoutes = require('./routes/apiRoutes')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const axios = require('./utils/axiosConfig'); // Use IPv4-specific axios
const runPatch = require('./utils/patchMobileIds');

// MongoDB Connection
mongoose.connect(process.env.BILLIT_MONGO_URI)
  .then(async () => {
    await runPatch(); // 🧠 Auto-patch MobileName _id values
  })
  .catch(err => {});

const app = express(); // ✅ MOVE THIS TO THE TOP

// Trust the first proxy (nginx) — required for express-rate-limit behind a reverse proxy
app.set('trust proxy', 1);

// ✅ Webhook MUST be mounted BEFORE express.json() — needs raw body for signature verification
const webhookRoutes = require("./routes/webhookRoutes");
app.use("/api", webhookRoutes);

// ✅ ADMS routes MUST also be mounted before express.json() so raw text bodies work
// The eSSL M20 device pushes plain-text attendance data, not JSON.
const admsRoutes = require("./routes/admsRoutes");
app.use("/iclock", admsRoutes);

app.use(express.json());
app.use(cors({
 origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.AUTH_SERVER_URL || 'http://localhost:7000',
    'http://localhost:7000',
    'http://127.0.0.1:7000',
    'http://127.0.0.1:3000',
    'http://[::1]:7000',        // ✅ Add IPv6 localhost for auth server
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://[::1]:8000',        // ✅ Add IPv6 localhost for billit server
    'http://89.116.121.212:3000',
     //Production domains
    'https://sales.infinestech.com',    // ✅ Production sales frontend
    'http://sales.infinestech.com',     // ✅ Fallback for sales frontend
    'https://auth.infinestech.com',     // ✅ Production auth server
    'http://auth.infinestech.com',      // ✅ Fallback for auth server
     //Sales Server Communication
    'http://localhost:9000',            // ✅ Sales server local
    'http://127.0.0.1:9000',
    'http://[::1]:9000'                 // ✅ IPv6 localhost for sales server
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key']
 }));
app.use(passport.initialize());
app.use("/api",apiRoutes);




// MongoDB Models
const {
  User, Manager, Branch, Shop, Dealer, Customer,
  Mobile, Technician, Role
} = require('./models/mongoModels');

const billitUserInfoRoutes = require("./routes/billitUserInfo");

// 👉 Add Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BILLIT_BACKEND_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;

    // 1️⃣ Check MySQL user
    const { data: authData } = await axios.post(`${process.env.AUTH_SERVER_URL}/verify-user-email`, { email });

    if (!authData.success) {
      return done(null, false, { message: "Not registered in Billit system." });
    }

    const mysqlUserId = authData.userId;

    // 2️⃣ Sync to Billit's MongoDB directly (no HTTP call needed)
    const { syncUserToBillit } = require('./controllers/userSyncController');
    const jwtToken = jwt.sign(
      { userId: mysqlUserId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    await syncUserToBillit(mysqlUserId, `Bearer ${jwtToken}`);

    // 3️⃣ Load Mongo user
    const user = await User.findOne({ mysql_user_id: mysqlUserId }).populate("role_id");

    if (!user || !user.isSubscriptionActive) {
      return done(null, false, { message: "Subscription expired or user missing." });
    }

    // ✅ Successful login
    return done(null, {
      _id: user._id,
      mongoPlanId: user.role_id.mongoPlanId
    });
  } catch (err) {
    return done(err, false);
  }
}));

// Import blacklist utility
const { isUserBlacklisted } = require('./utils/tokenBlacklist');

// 🔐 JWT Middleware for Billit
const authenticateBillitToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token." });
    }

    try {
      const user = await User.findById(decodedUser.userId).populate('role_id');

      if (!user) {
        return res.status(404).json({ message: "User not found in MongoDB." });
      }

      // Check if MySQL user is blacklisted (deleted)
      if (isUserBlacklisted(user.mysql_user_id)) {
        return res.status(403).json({ 
          message: "Account has been deleted. Please contact support if you believe this is an error." 
        });
      }

      req.user = {
        userId: user._id,
        mysqlUserId: user.mysql_user_id,
        mongoPlanId: user.role_id.mongoPlanId,
        isSubscriptionActive: user.isSubscriptionActive
      };

      next();
    } catch (error) {
      return res.status(500).json({ message: "Internal server error during token verification." });
    }
  });
};



// 💡 Import Routes
const billitRoutes = require("./routes/billitRoutes");
app.use("/api", billitUserInfoRoutes);

const userFeatureRoutes = require('./routes/getUserFeatures');
app.use('/api', userFeatureRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

const shopAdminRoutes = require('./routes/shopAdminRoutes');
app.use('/api/shop-admin', shopAdminRoutes);

const subscriptionPageRoutes = require('./routes/subscriptionPageRoutes');
const userSyncRoutes = require('./routes/userSyncRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboard');
const mobileDashboardFullRoutes = require('./routes/mobile-dashboard-full');
const paymentRoutes = require('./routes/payment');

// ✅ Mount Routes After `app` is declared
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard', mobileDashboardFullRoutes);
app.use("/api", billitRoutes);
app.use('/api', subscriptionPageRoutes);
app.use('/api', userSyncRoutes);
app.use('/api', authRoutes);
app.use('/api', paymentRoutes);


// 🏁 Start Server

const PORT = process.env.BILLIT_PORT;
app.listen(PORT, '0.0.0.0', () => {});

module.exports = { app, authenticateBillitToken };
