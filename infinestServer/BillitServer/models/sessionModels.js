const mongoose = require("mongoose");

// ==============================
// 🔐 Session Schema (Tracks Active User Sessions)
// ==============================
const sessionSchema = new mongoose.Schema({
  user_identifier: { 
    type: String, 
    required: true
    // ✅ Removed unique constraint to allow multiple sessions per user
  },
  user_type: {
    type: String,
    enum: ['regular_user', 'shop_admin'],
    required: true,
    default: 'regular_user'
  },
  session_token: { 
    type: String, 
    required: true, 
    unique: true 
  },
  jwt_token_signature: { 
    type: String, 
    required: true 
  },
  ip_address: { 
    type: String 
  },
  user_agent: { 
    type: String 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  last_activity: { 
    type: Date, 
    default: Date.now 
  },
  expires_at: { 
    type: Date, 
    required: true,
    index: { expires: 0 } // ✅ TTL index: MongoDB will auto-delete expired sessions
  }
});

// ✅ Index for efficient session lookup
sessionSchema.index({ jwt_token_signature: 1 });
sessionSchema.index({ user_type: 1 });
sessionSchema.index({ user_identifier: 1 }); // ✅ For finding all sessions of a user

const Session = mongoose.model("Session", sessionSchema);

module.exports = { Session };
