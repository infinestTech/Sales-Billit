require('dotenv').config();

const authenticateToken = require("./middleware/authenticateToken");
const internalAuth = require("./middleware/internalAuth");
const { authLimiter } = require("./middleware/rateLimiter");
const { createJWT } = require("./utils/jwtUtils");
const multer = require('multer');
const path = require('path');

const profileRoutes = require('./routes/profile');
const subscriptionRoutes = require('./routes/subscription');
const adminRoutes = require('./routes/admin');

const moment = require('moment-timezone');
const { getISTTodayRange, addTimeIST } = require('./utils/dateHelper');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// ✅ Create IPv4-specific axios instance
const axios = require('axios').create({
  family: 4,  // Force IPv4
  timeout: 10000
});

// 🔧 For local services, automatically switch https -> http for localhost/127.0.0.1 to avoid SSL errors
axios.interceptors.request.use((config) => {
  try {
    const base = config.baseURL || undefined;
    const rawUrl = typeof config.url === 'string' ? config.url : '';
    if (!rawUrl) return config;

    const full = new URL(rawUrl, base);
    if ((full.hostname === 'localhost' || full.hostname === '127.0.0.1') && full.protocol === 'https:') {
      full.protocol = 'http:';
      config.url = full.toString();
    }
  } catch (_) {
    // ignore URL parsing errors
  }
  return config;
});

const cron = require('node-cron');

const prisma = new PrismaClient();
const app = express();

const fs = require('fs');
const uploadPath = path.join(__dirname, 'uploads', 'profile_images');
fs.mkdirSync(uploadPath, { recursive: true });


app.use(express.json());
app.use(cors({
   origin: [
     process.env.FRONTEND_URL || 'http://localhost:3000',
     process.env.BILLIT_SERVER_URL || 'http://localhost:8000',
  'http://localhost:3020',      // ✅ Allow sales-frontend dev server
  'http://127.0.0.1:3020',
     'http://localhost:3000',       // ✅ Add common frontend origins
     'https://localhost:3000',
     'http://127.0.0.1:3000',
     'https://127.0.0.1:3000',
     // Production Sales Domain
     'https://sales.infinestech.com',   // ✅ Production sales frontend
     'http://sales.infinestech.com',    // ✅ Fallback for sales frontend
     // Sales Server Internal Communication
     'http://localhost:9000',           // ✅ Sales server local
     'http://127.0.0.1:9000',
     'http://[::1]:9000',              // ✅ IPv6 localhost for sales server
     'http://localhost:8000',
     'http://127.0.0.1:8000',
     'http://[::1]:8000',          // ✅ Add IPv6 localhost for billit server
     'http://localhost:7000',
     'http://127.0.0.1:7000',
     'http://[::1]:7000',          // ✅ Add IPv6 localhost for auth server
     'null'                        // ✅ Allow file:// origins for local testing
   ],
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key']
 }));
app.use(passport.initialize());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(subscriptionRoutes);


// ✅ GOOGLE AUTH SETUP
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const googleId = profile.id;
  const name = profile.displayName;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        googleId,
        name,
        username: email.split('@')[0],  // auto-generate username
        phone: null,  // phone nullable
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { email },
      data: { googleId },
    });
  }

  return done(null, user);
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  const token = createJWT({ userId: req.user.id });
  res.redirect(`${process.env.FRONTEND_URL}/callback?token=${token}`);
});

app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);

// ✅ USER SIGNUP
app.post('/signup', authLimiter, async (req, res) => {
  const { username, email, phone, password, name, address, imageUrl } = req.body;


  // Basic required fields check
  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }


  // Check if user already exists (by email or phone)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone }
      ]
    }
  });


  if (existingUser) {
    return res.status(409).json({ error: 'User already exists.' });
  }


  const hashedPassword = await bcrypt.hash(password, 10);


  // Create the user, ensuring empty strings are stored as null
  const user = await prisma.user.create({
    data: {
      username,
      email,
      phone,
      password: hashedPassword,
      name,
      address: address && address.trim() !== "" ? address : null,
      imageUrl: imageUrl && imageUrl.trim() !== "" ? imageUrl : null
    }
  });


  const token = createJWT({ userId: user.id });


  res.status(201).json({
    message: 'User created successfully',
    token
  });
});



// ✅ Multer configuration for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profile_images'); // ✅ folder to save uploads
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});


const upload = multer({ storage });




// CommonDB/server_auth.js


app.post('/upload/profile-image', upload.single('profileImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }


  const imageUrl = `${process.env.SERVER_URL}/uploads/profile_images/${req.file.filename}`;
  res.json({ imageUrl });
});




// ✅ USER LOGIN
app.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !user.password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createJWT({ userId: user.id });

  res.json({
    message: "Login successful",
    token
  });
});




//this is for the sake of billit login
app.post('/verify-user-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    // 1️⃣ Find user in MySQL
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // 2️⃣ Validate password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password); // ✅ Correct way

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid password." });
    }

    // 3️⃣ Success: return userId
    return res.json({
      success: true,
      userId: user.id  // 👈 Prisma model field "id" (uuid)
    });

  } catch (err) {
    console.error('Verify Login Error:', err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ✅ Endpoint for verifying user exists by email (for Google OAuth)
app.post('/verify-user-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  try {
    // Find user in MySQL by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Success: return userId
    return res.json({
      success: true,
      userId: user.id
    });

  } catch (err) {
    console.error('Verify User Email Error:', err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});



app.post("/mysql-subscribe", authenticateToken, async (req, res) => {

  const { mongoPlanId, mongoCategoryId, amount, product: incomingProduct } = req.body;
  const userId = req.user.userId;
  const product = incomingProduct || "SERVICE"; // ✅ default for backward compatibility

  // Map arbitrary product names to allowed ProductAccess enum values
  const normalizeProductForAccess = (p) => {
    const allowed = ["BILLIT", "SERVICE", "SALES", "FUTURE_PRODUCT"]; // matches Prisma enum (updated)
    return allowed.includes(p) ? p : "FUTURE_PRODUCT";
  };
  const productForAccess = normalizeProductForAccess(product);


  try {
    // ✅ Step 1: Get plan using mongoPlanId
    const plan = await prisma.plan.findFirst({
      where: { mongoPlanId }
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found in MySQL for given mongoPlanId" });
    }

    // ✅ Validate plan has proper duration (except for Basic plans)
    if (plan.name !== "Basic" && (!plan.duration || !["MONTHLY", "YEARLY"].includes(plan.duration))) {
      console.error(`❌ Plan ${plan.id} has invalid duration: ${plan.duration}`);
      return res.status(400).json({ message: "Plan has invalid or missing duration" });
    }

    const planId = plan.id;

  // ✅ Step 2: Check if user already has *any* subscription to this product
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
    product
      },
      include: {
        plan: true
      }
    });

    if (existingSubscription) {
      const existingPlan = existingSubscription.plan;

      if (existingPlan.id === planId) {
        return res.status(400).json({
          message: "User already subscribed to this plan."
        });
      }

      // ✅ Use the incoming `mongoCategoryId` from request
      if (existingPlan.mongoCategoryId === mongoCategoryId) {
        return res.status(400).json({
          message: "User already has a subscription in this category."
        });
      }

      return res.status(400).json({
        message: "User already has an active subscription to SERVICE."
      });
    }

  // ✅ Step 3: Create payment
    await prisma.payment.create({
      data: {
        userId,
        amount,
        status: "COMPLETED"
      }
    });

    // ✅ Calculate proper end date based on plan type and duration
    let endDate;
    
    // 🟩 BASIC PLAN → NULL endDate (never expires)
    if (plan.name === "Basic") {
      endDate = null;
      console.log(`✅ Basic plan detected: Setting endDate to NULL for unlimited access`);
    } else {
      // 🟨 PAID PLAN → Calculate based on duration
      if (plan.duration === "MONTHLY") {
        endDate = moment().tz("Asia/Kolkata").add(1, 'month').toDate();
      } else if (plan.duration === "YEARLY") {
        endDate = moment().tz("Asia/Kolkata").add(1, 'year').toDate();
      } else {
        // Fallback for plans without duration (should not happen, but safety check)
        console.warn(`⚠️ Plan ${planId} has invalid duration: ${plan.duration}, defaulting to 30 days`);
        endDate = moment().tz("Asia/Kolkata").add(30, 'days').toDate();
      }
    }
    // const endDate = moment().tz("Asia/Kolkata").add(1, 'minute').toDate();

  // ✅ Step 4: Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
    product,
        status: "ACTIVE",
        endDate: endDate // 👈 Always set in IST-based date object
      }
    });

    // ✅ Update User's subscriptionId to link the subscription
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: subscription.id }
    });

    // ✅ Step 5: Ensure Product Access
    const access = await prisma.productAccess.findFirst({
      where: {
        userId,
        product: productForAccess
      }
    });

    if (!access) {
      await prisma.productAccess.create({
        data: {
          userId,
          product: productForAccess
        }
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return res.json({
      message: `User successfully subscribed to ${product}.`,
      email: user.email,
      subscription
    });

  } catch (err) {
    console.error("MySQL Subscription Error:", err);
    return res.status(500).json({
      message: "Subscription error (MySQL)",
      error: err.message
    });
  }
});


// ✅ Log Subscription Event API
app.post("/log-subscription-event", internalAuth, async (req, res) => {

  const { userId, subscriptionId, paymentId, action, message, metadata } = req.body;

  if (!userId || !action || !message) {
    return res.status(400).json({
      message: "Missing required fields: userId, action, or message"
    });
  }

  try {
    await prisma.subscriptionLog.create({
      data: {
        userId,
        subscriptionId: subscriptionId || null,
        paymentId: paymentId || null,
        action,
        message,
        metadata: metadata || {}
      }
    });

    res.status(200).json({ message: "✅ Log recorded successfully" });
  } catch (err) {
    console.error("❌ Failed to insert subscription log:", err);
    res.status(500).json({
      message: "Failed to log subscription event",
      error: err.message
    });
  }
});



app.post("/upgrade-subscription", authenticateToken, async (req, res) => {

  const { newMongoPlanId, newMongoCategoryId, amount, product: incomingProduct } = req.body;
  const userId = req.user.userId;
  const product = incomingProduct || "SERVICE";
  const normalizeProductForAccess = (p) => {
    const allowed = ["BILLIT", "SERVICE", "SALES", "FUTURE_PRODUCT"]; // matches Prisma enum
    return allowed.includes(p) ? p : "FUTURE_PRODUCT";
  };
  const productForAccess = normalizeProductForAccess(product);


  if (!userId || !newMongoPlanId || !newMongoCategoryId || !amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const currentSub = await prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE", product },
      orderBy: { createdAt: "desc" },
      include: { plan: true }
    });

    const plan = await prisma.plan.findFirst({
      where: { mongoPlanId: newMongoPlanId }
    });

    if (!plan) {
      return res.status(400).json({ message: "Plan not found in SQL DB" });
    }

    // ✅ Validate plan has proper duration (except for Basic plans)
    if (plan.name !== "Basic" && (!plan.duration || !["MONTHLY", "YEARLY"].includes(plan.duration))) {
      console.error(`❌ Plan ${plan.id} has invalid duration: ${plan.duration}`);
      return res.status(400).json({ message: "Plan has invalid or missing duration" });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        status: "COMPLETED"
      }
    });

    // Log PAYMENT_COMPLETED
    try {
      await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
        userId,
        paymentId: payment.id,
        action: "PAYMENT_COMPLETED",
        message: `User paid ₹${amount} for upgraded subscription.`,
        metadata: {
          amount,
          mongoPlanId: newMongoPlanId,
          mongoCategoryId: newMongoCategoryId
        }
      },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_API_KEY
          }
        }
      );
    } catch (err) {
      console.warn("⚠️ Failed to log PAYMENT_COMPLETED:", err.message);
    }

    let newSub;

    if (currentSub) {
      if (currentSub.plan.id === plan.id) {
        // 🟩 SAME PLAN → Queue subscription

        // ⚠️ Special handling for Basic plans (they never expire, so can't be queued)
        if (plan.name === "Basic") {
          console.log(`⚠️ User already has active Basic plan - Basic plans don't need renewal/queueing`);
          return res.json({
            message: "✅ User already has active Basic plan (no expiry needed).",
            currentSubscription: currentSub
          });
        }

        const queuedStartDate = new Date(currentSub.endDate);
        let queuedEndDate;
        
        // ✅ Use moment for reliable date calculation
        if (plan.duration === "MONTHLY") {
          queuedEndDate = moment(queuedStartDate).tz("Asia/Kolkata").add(1, 'month').toDate();
        } else if (plan.duration === "YEARLY") {
          queuedEndDate = moment(queuedStartDate).tz("Asia/Kolkata").add(1, 'year').toDate();
        } else {
          // Fallback for plans without duration (should not happen, but safety check)
          console.warn(`⚠️ Plan ${plan.id} has invalid duration: ${plan.duration}, defaulting to 30 days from start`);
          queuedEndDate = moment(queuedStartDate).tz("Asia/Kolkata").add(30, 'days').toDate();
        }

    newSub = await prisma.subscription.create({
          data: {
            userId,
            planId: plan.id,
      product,
            status: "QUEUED",
            startDate: queuedStartDate,
            endDate: queuedEndDate
          }
        });

        // Note: Don't update User.subscriptionId for QUEUED subscriptions
        // Only update when subscription becomes ACTIVE

        // Log SUBSCRIPTION_STARTED (queued)
        try {
          await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
            userId,
            subscriptionId: newSub.id,
            action: "SUBSCRIPTION_STARTED",
            message: `Queued subscription created to start after current expires.`,
            metadata: {
              newPlanId: plan.id,
              mongoPlanId: newMongoPlanId,
              mongoCategoryId: newMongoCategoryId,
              amount
            }
          },
            {
              headers: {
                "x-internal-key": process.env.INTERNAL_API_KEY
              }
            }
          );
        } catch (logErr) {
          console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
        }

        return res.json({
          message: "✅ Subscription queued successfully after current plan.",
          newSubscription: newSub
        });

      } else {
        // 🟥 DIFFERENT PLAN → Expire current and activate new immediately

        await prisma.subscription.update({
          where: { id: currentSub.id },
          data: { status: "EXPIRED" }
        });

        // Log SUBSCRIPTION_CANCELLED
        try {
          await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
            userId,
            subscriptionId: currentSub.id,
            action: "SUBSCRIPTION_CANCELLED",
            message: "Subscription expired early due to upgrade.",
            metadata: {
              fromPlanId: currentSub.planId,
              toPlanId: newMongoPlanId,
              reason: "Upgrade"
            }
          },
            {
              headers: {
                "x-internal-key": process.env.INTERNAL_API_KEY
              }
            }
          );
        } catch (err) {
          console.warn("⚠️ Failed to log SUBSCRIPTION_CANCELLED:", err.message);
        }

        // Remove product access
    await prisma.productAccess.deleteMany({
          where: {
            userId,
      product: productForAccess
          }
        });

        // Create new active subscription
        const startDate = new Date();
        let endDate;
        
        // ✅ Calculate proper end date based on plan type and duration
        if (plan.name === "Basic") {
          // 🟩 BASIC PLAN → NULL endDate (never expires)
          endDate = null;
          console.log(`✅ Upgrading to Basic plan: Setting endDate to NULL for unlimited access`);
        } else {
          // 🟨 PAID PLAN → Calculate based on duration
          if (plan.duration === "MONTHLY") {
            endDate = moment().tz("Asia/Kolkata").add(1, 'month').toDate();
          } else if (plan.duration === "YEARLY") {
            endDate = moment().tz("Asia/Kolkata").add(1, 'year').toDate();
          } else {
            // Fallback for plans without duration (should not happen, but safety check)
            console.warn(`⚠️ Plan ${plan.id} has invalid duration: ${plan.duration}, defaulting to 30 days`);
            endDate = moment().tz("Asia/Kolkata").add(30, 'days').toDate();
          }
        }

    newSub = await prisma.subscription.create({
          data: {
            userId,
            planId: plan.id,
      product,
            status: "ACTIVE",
            startDate,
            endDate
          }
        });

        // ✅ Update User's subscriptionId to link the subscription
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionId: newSub.id }
        });

        // Grant product access
    await prisma.productAccess.create({
          data: {
            userId,
      product: productForAccess
          }
        });

        // Log SUBSCRIPTION_STARTED
        try {
          await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
            userId,
            subscriptionId: newSub.id,
            action: "SUBSCRIPTION_STARTED",
            message: "User upgraded to a new plan",
            metadata: {
              newPlanId: plan.id,
              mongoPlanId: newMongoPlanId,
              mongoCategoryId: newMongoCategoryId,
              amount
            }
          },
            {
              headers: {
                "x-internal-key": process.env.INTERNAL_API_KEY
              }
            }
          );
        } catch (logErr) {
          console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
        }

        return res.json({
          message: "✅ Subscription upgraded and activated successfully.",
          newSubscription: newSub
        });
      }
    } else {
      // 🟦 NO ACTIVE PLAN → Normal subscription
      const startDate = new Date();
      let endDate;
      
      // ✅ Calculate proper end date based on plan type and duration
      if (plan.name === "Basic") {
        // 🟩 BASIC PLAN → NULL endDate (never expires)
        endDate = null;
        console.log(`✅ First-time Basic plan: Setting endDate to NULL for unlimited access`);
      } else {
        // 🟨 PAID PLAN → Calculate based on duration
        if (plan.duration === "MONTHLY") {
          endDate = moment().tz("Asia/Kolkata").add(1, 'month').toDate();
        } else if (plan.duration === "YEARLY") {
          endDate = moment().tz("Asia/Kolkata").add(1, 'year').toDate();
        } else {
          // Fallback for plans without duration (should not happen, but safety check)
          console.warn(`⚠️ Plan ${plan.id} has invalid duration: ${plan.duration}, defaulting to 30 days`);
          endDate = moment().tz("Asia/Kolkata").add(30, 'days').toDate();
        }
      }

    newSub = await prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
      product,
          status: "ACTIVE",
          startDate,
          endDate
        }
      });

      // ✅ Update User's subscriptionId to link the subscription
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionId: newSub.id }
      });

      // Grant product access
    await prisma.productAccess.create({
        data: {
          userId,
      product: productForAccess
        }
      });

      // Log SUBSCRIPTION_STARTED
      try {
        await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
          userId,
          subscriptionId: newSub.id,
          action: "SUBSCRIPTION_STARTED",
          message: "New subscription started successfully.",
          metadata: {
            newPlanId: plan.id,
            mongoPlanId: newMongoPlanId,
            mongoCategoryId: newMongoCategoryId,
            amount
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
      }

      return res.json({
        message: "✅ Subscription started successfully.",
        newSubscription: newSub
      });
    }

  } catch (err) {
    console.error("❌ Upgrade error:", err);
    return res.status(500).json({ message: "Upgrade failed", error: err.message });
  }
});




app.post("/get-user-billit-access", authenticateToken, async (req, res) => {
  const userId = req.user.userId;


  if (!userId) {
    return res.status(400).json({ hasAccess: false, message: "Missing userId." });
  }

  try {
  // ✅ Step 1: Get subscription and plan details in one go
  // Backward compatibility: accept legacy product value "BILLIT" as well as new "SERVICE"
  const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
    product: { in: ["SERVICE", "BILLIT"] },
        status: "ACTIVE"
      },
      select: {
        plan: {
          select: {
            mongoPlanId: true
          }
        }
      }
    });

    if (!subscription || !subscription.plan) {
      return res.json({ hasAccess: false });
    }

  // ✅ Step 2: Return mongoPlanId from MySQL plan table
    return res.json({
      hasAccess: true,
      mongoPlanId: subscription.plan.mongoPlanId
    });

  } catch (error) {
    console.error("Error checking user access:", error);
    res.status(500).json({ hasAccess: false, message: "Server error" });
  }
});

// ✅ Generic: SALES product access check
app.post("/get-user-sales-access", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  if (!userId) {
    return res.status(400).json({ hasAccess: false, message: "Missing userId." });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
        product: { in: ["SALES", "SERVICE"] }, // accept SERVICE for backward compatibility
        status: "ACTIVE"
      },
      select: {
        plan: {
          select: { mongoPlanId: true }
        }
      }
    });

    if (!subscription || !subscription.plan) {
      return res.json({ hasAccess: false });
    }

    return res.json({
      hasAccess: true,
      mongoPlanId: subscription.plan.mongoPlanId
    });

  } catch (error) {
    console.error("Error checking SALES user access:", error);
    res.status(500).json({ hasAccess: false, message: "Server error" });
  }
});


app.get('/check-active-subscription', async (req, res) => {
  let userId;

  // 1️⃣ Try token
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      console.log("✅ userId extracted from JWT token:", userId);
    } catch (err) {
      return res.status(403).json({ message: "Invalid token." });
    }
  }

  // 2️⃣ Fallback to query or body
  if (!userId) {
    userId = req.query.userId || req.body?.userId;
    console.log("🔁 userId extracted from query/body:", userId);
  }

  if (!userId) {
    return res.status(400).json({ message: "Missing userId or token." });
  }

  try {
    const activeSubscription = await prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { plan: true }
    });

    if (!activeSubscription) {
      return res.json({ hasActivePlan: false });
    }

    return res.json({
      hasActivePlan: true,
      planName: activeSubscription.plan.name,
      planPrice: activeSubscription.plan.price,
      subscriptionId: activeSubscription.id
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


app.post("/internal-verify-token", internalAuth, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(400).json({ valid: false, message: "Token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) return res.status(404).json({ valid: false, message: "User not found" });

    res.json({
      valid: true,
      user: {
        userId: user.id,
        email: user.email
      }
    });
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(401).json({ valid: false, message: "Invalid token" });
  }
});

// Internal: return plan info (including branchLimit) for a given mongoPlanId
// Used by SalesServer's fetchBranchLimitByMongoPlanId helper
app.post('/internal-plan-by-mongo-id', internalAuth, async (req, res) => {
  const { mongoPlanId } = req.body || {};
  if (!mongoPlanId) return res.status(400).json({ message: 'Missing mongoPlanId' });

  try {
    const plan = await prisma.plan.findFirst({
      where: { mongoPlanId },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        branchLimit: true,
        mongoPlanId: true,
        mongoCategoryId: true
      }
    });

    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    return res.json({ plan });
  } catch (err) {
    console.error('Internal plan lookup failed:', err.message || err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Public fallback: get plan by mongoPlanId (no internal auth). Prefer internal endpoint when possible.
app.get('/plan/by-mongo/:mongoPlanId', async (req, res) => {
  const mongoPlanId = req.params.mongoPlanId;
  if (!mongoPlanId) return res.status(400).json({ message: 'Missing mongoPlanId' });
  try {
    const plan = await prisma.plan.findFirst({
      where: { mongoPlanId },
      select: { id: true, name: true, branchLimit: true, mongoPlanId: true }
    });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    return res.json({ plan });
  } catch (err) {
    console.error('Plan lookup (public) failed:', err.message || err);
    return res.status(500).json({ message: 'Server error' });
  }
});




cron.schedule("30 18 * * *", async () => {
  // ⏰ This will run at 12:00 AM IST daily
  console.log("🕐 [IST] Running subscription expiry check...");

  const nowIST = moment().tz("Asia/Kolkata");

  try {
    const activeSubs = await prisma.subscription.findMany({
      where: { status: "ACTIVE" }
    });

    let expiredCount = 0;

    for (const sub of activeSubs) {
      const endDateIST = moment(sub.endDate).tz("Asia/Kolkata");
      const isExpired = endDateIST.isBefore(nowIST);

      if (isExpired) {
        console.log(`❌ Expiring subscription for user: ${sub.userId}`);

        // 1️⃣ Mark as EXPIRED
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" }
        });

        // 2️⃣ Remove product access
        await prisma.productAccess.deleteMany({
          where: {
            userId: sub.userId,
            product: sub.product
          }
        });

        // 3️⃣ Inform MongoDB to mark inactive
        try {
          await axios.post(`${process.env.BILLIT_SERVER_URL}/api/expire-user-subscription`, {
            userId: sub.userId
          });
        } catch (err) {
          console.error("MongoDB update failed:", err?.response?.data || err.message);
        }

        // 4️⃣ Log to MySQL
        try {
          await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
            userId: sub.userId,
            subscriptionId: sub.id,
            action: "SUBSCRIPTION_EXPIRED",
            message: `Subscription expired on ${endDateIST.format("YYYY-MM-DD HH:mm:ss")}`,
            metadata: {
              planId: sub.planId,
              expiredAt: endDateIST.toISOString()
            }
          },
            {
              headers: {
                "x-internal-key": process.env.INTERNAL_API_KEY
              }
            }
          );
        } catch (logErr) {
          console.warn("⚠️ Failed to log SUBSCRIPTION_EXPIRED:", logErr.message);
        }

        // 5️⃣ Check and activate the next queued plan automatically
        const nextQueued = await prisma.subscription.findFirst({
          where: {
            userId: sub.userId,
            product: sub.product,
            status: "QUEUED"
          },
          orderBy: {
            startDate: 'asc'
          },
          include: {
            plan: true // ✅ Include plan details to calculate proper endDate
          }
        });

        if (nextQueued) {
          // ✅ Calculate proper end date based on plan type and duration
          let newEndDate;
          
          if (nextQueued.plan.name === "Basic") {
            // 🟩 BASIC PLAN → NULL endDate (never expires)
            newEndDate = null;
            console.log(`✅ Activating queued Basic plan: Setting endDate to NULL for unlimited access`);
          } else {
            // 🟨 PAID PLAN → Calculate based on duration
            if (nextQueued.plan.duration === "MONTHLY") {
              newEndDate = moment().tz("Asia/Kolkata").add(1, 'month').toDate();
            } else if (nextQueued.plan.duration === "YEARLY") {
              newEndDate = moment().tz("Asia/Kolkata").add(1, 'year').toDate();
            } else {
              // Fallback for plans without duration (should not happen, but safety check)
              console.warn(`⚠️ Queued plan ${nextQueued.planId} has invalid duration: ${nextQueued.plan.duration}, defaulting to 30 days`);
              newEndDate = moment().tz("Asia/Kolkata").add(30, 'days').toDate();
            }
          }

          await prisma.subscription.update({
            where: { id: nextQueued.id },
            data: {
              status: "ACTIVE",
              startDate: new Date(), // now in UTC
              endDate: newEndDate
            }
          });

          // ✅ Update User's subscriptionId to link the newly activated subscription
          await prisma.user.update({
            where: { id: sub.userId },
            data: { subscriptionId: nextQueued.id }
          });

          // Ensure product access is restored
          await prisma.productAccess.create({
            data: {
              userId: sub.userId,
              product: sub.product
            }
          });

          console.log(`✅ Activated next queued plan for user: ${sub.userId}`);

          // Optional: Notify MongoDB about activation
          try {
            await axios.post(`${process.env.BILLIT_SERVER_URL}/api/activate-user-subscription`, {
              userId: sub.userId,
              subscriptionId: nextQueued.id
            });
          } catch (mongoActivateErr) {
            console.error("MongoDB activate update failed:", mongoActivateErr?.response?.data || mongoActivateErr.message);
          }
        } else{
          // 🟥 NO QUEUED PLAN → Automatically downgrade to Basic plan
          console.log(`📉 No queued plan found for user ${sub.userId}, creating automatic Basic plan downgrade`);
          
          try {
            // Find Basic plan
            const basicPlan = await prisma.plan.findFirst({
              where: { name: "Basic" }
            });

            if (basicPlan) {
              // Create Basic plan subscription with NULL endDate
              const basicSubscription = await prisma.subscription.create({
                data: {
                  userId: sub.userId,
                  planId: basicPlan.id,
                  product: sub.product,
                  status: "ACTIVE",
                  startDate: new Date(),
                  endDate: null // ✅ Basic plan never expires
                }
              });

              // ✅ Update User's subscriptionId to link the subscription
              await prisma.user.update({
                where: { id: sub.userId },
                data: { subscriptionId: basicSubscription.id }
              });

              // Ensure product access is restored
              await prisma.productAccess.create({
                data: {
                  userId: sub.userId,
                  product: sub.product
                }
              });

              console.log(`✅ Automatically downgraded user ${sub.userId} to Basic plan (ID: ${basicSubscription.id})`);

              // Log the automatic downgrade
              try {
                await axios.post(`${process.env.SERVER_URL}/log-subscription-event`, {
                  userId: sub.userId,
                  subscriptionId: basicSubscription.id,
                  action: "SUBSCRIPTION_STARTED",
                  message: "Automatically downgraded to Basic plan after subscription expiry",
                  metadata: {
                    previousPlanId: sub.planId,
                    newPlanId: basicPlan.id,
                    downgradeReason: "AUTOMATIC_BASIC_FALLBACK"
                  }
                },
                  {
                    headers: {
                      "x-internal-key": process.env.INTERNAL_API_KEY
                    }
                  }
                );
              } catch (logErr) {
                console.warn("⚠️ Failed to log automatic Basic plan downgrade:", logErr.message);
              }

              // Notify MongoDB about basic plan activation
              try {
                await axios.post(`${process.env.BILLIT_SERVER_URL}/api/activate-user-subscription`, {
                  userId: sub.userId,
                  subscriptionId: basicSubscription.id,
                  planType: "BASIC_DOWNGRADE"
                });
              } catch (mongoErr) {
                console.error("MongoDB basic plan activation failed:", mongoErr?.response?.data || mongoErr.message);
              }
            } else {
              console.error(`❌ Basic plan not found in database for automatic downgrade - user ${sub.userId} left without subscription`);
            }
          } catch (downgradeErr) {
            console.error(`❌ Failed to create automatic Basic plan for user ${sub.userId}:`, downgradeErr.message);
          }
        }

        expiredCount++;
      }
    }


    console.log(`✅ [IST] ${expiredCount} subscriptions expired.`);
  } catch (err) {
    console.error("🚨 Cron Error:", err.message);
  }
});

 


 app.post("/get-mysql-user", async (req, res) => {
  const { userId } = req.body;


  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }


  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        name: true,
        email: true,
        address: true,
        imageUrl: true,
      }
    });


    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    res.json({
      phone: user.phone || "",
      email: user.email || "",
      name: user.name || "",
      address: user.address || "",
      imageUrl: user.imageUrl || "",
    });
  } catch (err) {
    console.error("❌ MySQL fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});




app.patch('/profile/update', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // ensure your JWT stores userId as "userId"


  const { name, phone, address, imageUrl } = req.body;


  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name && name.trim() !== "" ? name : undefined,
        phone: phone && phone.trim() !== "" ? phone : undefined,
        address: address && address.trim() !== "" ? address : undefined,
        imageUrl: imageUrl && imageUrl.trim() !== "" ? imageUrl : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        imageUrl: true,
      },
    });


    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (err) {
    console.error('❌ Profile update error:', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// ✅ New endpoint for free basic plan subscription
app.post("/mysql-subscribe-free", authenticateToken, async (req, res) => {
  const { mongoPlanId, mongoCategoryId, amount, product: incomingProduct } = req.body;
  const userId = req.user.userId;
  const product = incomingProduct || "SERVICE";
  const normalizeProductForAccess = (p) => {
    const allowed = ["BILLIT", "SERVICE", "SALES", "FUTURE_PRODUCT"]; // matches Prisma enum
    return allowed.includes(p) ? p : "FUTURE_PRODUCT";
  };
  const productForAccess = normalizeProductForAccess(product);

  if (!mongoPlanId || !mongoCategoryId || amount !== 0) {
    return res.status(400).json({ message: "Invalid request for free subscription" });
  }

  try {
    // ✅ Step 1: Get plan using mongoPlanId
    const plan = await prisma.plan.findFirst({
      where: { mongoPlanId }
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found in MySQL for given mongoPlanId" });
    }

    const planId = plan.id;

    // ✅ Step 2: Check if user already has *any* subscription to SERVICE
  const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
    product,
        status: "ACTIVE"
      },
      include: {
        plan: true
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        message: "User already has an active subscription to SERVICE."
      });
    }

    // ✅ Step 3: Create payment record with 0 amount
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: 0,
        status: "COMPLETED"
      }
    });

    // ✅ Step 4: Create subscription with NULL end date for basic plan
  const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
    product,
        status: "ACTIVE",
        endDate: null // ✅ NULL for basic plan - no expiry
      }
    });

    // ✅ Update User's subscriptionId to link the subscription
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: subscription.id }
    });

    // ✅ Step 5: Ensure Product Access
  const access = await prisma.productAccess.findFirst({
      where: {
        userId,
    product: productForAccess
      }
    });

    if (!access) {
    await prisma.productAccess.create({
        data: {
          userId,
      product: productForAccess
        }
      });
    }

    // ✅ Step 6: Log subscription event
    try {
      await prisma.subscriptionLog.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          paymentId: payment.id,
          action: "SUBSCRIPTION_STARTED",
          message: "Free basic plan subscription activated",
          metadata: {
            planId,
            mongoPlanId,
            mongoCategoryId,
            amount: 0,
            planType: "FREE_BASIC"
          }
        }
      });
    } catch (logErr) {
      console.warn("⚠️ Failed to create subscription log:", logErr.message);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return res.json({
      message: "User successfully subscribed to free basic plan.",
      email: user.email,
      subscription,
      subscriptionId: subscription.id
    });

  } catch (err) {
    console.error("MySQL Free Subscription Error:", err);
    return res.status(500).json({
      message: "Free subscription error (MySQL)",
      error: err.message
    });
  }
});






// ✅ New endpoint for dashboard data
// Fetches user profile and subscription data for dashboard display
// Used by Billit server to get MySQL user data without direct database access
app.post("/get-user-dashboard-data", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing userId." });
  }

  try {
    // Get today's date range in IST
    const { startOfDay, endOfDay } = getISTTodayRange();

    // Get user basic info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        imageUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Get active subscription info
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
        status: "ACTIVE"
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            mongoPlanId: true,
            mongoCategoryId: true
          }
        }
      }
    });

    // Calculate user metrics (days since joining, etc.)
    const daysSinceJoining = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        daysSinceJoining
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        plan: subscription.plan
      } : null
    });

  } catch (error) {
    console.error("Error fetching user dashboard data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ SERVER LISTENING
const PORT = process.env.AUTH_PORT || 7000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Auth Server running on Port ${PORT}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
});

