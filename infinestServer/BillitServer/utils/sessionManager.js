const crypto = require('crypto');
const { Session } = require('../models/sessionModels');

/**
 * 🔐 Session Manager for enforcing configurable session limits per user
 */
class SessionManager {
  
  /**
   * Create a new session for a user (enforces session limit)
   * @param {String} userIdentifier - User ID (MySQL user ID or Shop Admin MongoDB ID)
   * @param {String} jwtToken - JWT token to associate with session
   * @param {Object} metadata - Optional metadata (ip, userAgent, userType, sessionLimit)
   * @returns {Object} Session data
   */
  static async createSession(userIdentifier, jwtToken, metadata = {}) {
    try {
      // Generate unique session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      // Extract signature from JWT (last part after final dot)
      const tokenParts = jwtToken.split('.');
      const jwtSignature = tokenParts[tokenParts.length - 1];
      
      // Calculate expiration (7 days to match JWT expiration)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const userType = metadata.userType || 'regular_user';
      const sessionLimit = metadata.sessionLimit || 1; // Default to 1 if not specified
      
      // ✅ Get existing active sessions for this user
      const existingSessions = await Session.find({ 
        user_identifier: userIdentifier,
        expires_at: { $gt: new Date() }
      }).sort({ created_at: 1 }); // Sort by oldest first
      
      // ✅ If session limit would be exceeded, delete oldest sessions
      if (existingSessions.length >= sessionLimit) {
        const sessionsToDelete = existingSessions.length - sessionLimit + 1;
        const oldestSessions = existingSessions.slice(0, sessionsToDelete);
        
        await Session.deleteMany({ 
          _id: { $in: oldestSessions.map(s => s._id) }
        });
        
        console.log(`🔄 Removed ${sessionsToDelete} old session(s) for ${userType} ${userIdentifier} (limit: ${sessionLimit})`);
      }
      
      // Create new session
      const session = await Session.create({
        user_identifier: userIdentifier,
        user_type: userType,
        session_token: sessionToken,
        jwt_token_signature: jwtSignature,
        ip_address: metadata.ip || null,
        user_agent: metadata.userAgent || null,
        expires_at: expiresAt,
        last_activity: new Date()
      });
      
      console.log(`✅ Session created for ${userType} ${userIdentifier}: ${sessionToken} (limit: ${sessionLimit})`);
      
      return {
        sessionToken,
        expiresAt
      };
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Validate if a JWT token has an active session
   * @param {String} userIdentifier - User ID from JWT
   * @param {String} jwtToken - Full JWT token
   * @returns {Boolean} true if session is valid
   */
  static async validateSession(userIdentifier, jwtToken) {
    try {
      // Extract JWT signature
      const tokenParts = jwtToken.split('.');
      const jwtSignature = tokenParts[tokenParts.length - 1];
      
      // Find active session for this user with this specific token
      const session = await Session.findOne({ 
        user_identifier: userIdentifier,
        jwt_token_signature: jwtSignature
      });
      
      if (!session) {
        console.log(`⚠️ No active session found for user ${userIdentifier}`);
        return false;
      }
      
      // Check if session has expired
      if (session.expires_at < new Date()) {
        console.log(`⚠️ Session expired for user ${userIdentifier}`);
        await Session.deleteOne({ _id: session._id });
        return false;
      }
      
      // ✅ Update last activity timestamp
      await Session.updateOne(
        { _id: session._id },
        { last_activity: new Date() }
      );
      
      return true;
    } catch (error) {
      console.error('❌ Error validating session:', error);
      return false;
    }
  }
  
  /**
   * Invalidate a user's session (logout)
   * @param {String} userIdentifier - User ID
   * @returns {Boolean} true if session was deleted
   */
  static async invalidateSession(userIdentifier) {
    try {
      const result = await Session.deleteMany({ user_identifier: userIdentifier });
      console.log(`✅ Session invalidated for user ${userIdentifier}: ${result.deletedCount} session(s) removed`);
      return result.deletedCount > 0;
    } catch (error) {
      console.error('❌ Error invalidating session:', error);
      throw error;
    }
  }
  
  /**
   * Get active sessions count for a user
   * @param {String} userIdentifier - User ID
   * @returns {Number} Number of active sessions
   */
  static async getActiveSessionsCount(userIdentifier) {
    try {
      const count = await Session.countDocuments({ 
        user_identifier: userIdentifier,
        expires_at: { $gt: new Date() }
      });
      return count;
    } catch (error) {
      console.error('❌ Error getting active sessions count:', error);
      return 0;
    }
  }
  
  /**
   * Get all active sessions for a user
   * @param {String} userIdentifier - User ID
   * @returns {Array} Array of session objects
   */
  static async getActiveSessions(userIdentifier) {
    try {
      const sessions = await Session.find({ 
        user_identifier: userIdentifier,
        expires_at: { $gt: new Date() }
      }).sort({ last_activity: -1 });
      return sessions;
    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      return [];
    }
  }
  
  /**
   * Get active session info for a user
   * @param {String} userIdentifier - User ID
   * @returns {Object|null} Session info or null
   */
  static async getSessionInfo(userIdentifier) {
    try {
      const session = await Session.findOne({ user_identifier: userIdentifier });
      return session;
    } catch (error) {
      console.error('❌ Error getting session info:', error);
      return null;
    }
  }
  
  /**
   * Clean up all expired sessions (can be run periodically)
   * MongoDB TTL index handles this automatically, but this can be used for manual cleanup
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await Session.deleteMany({ 
        expires_at: { $lt: new Date() } 
      });
      console.log(`✅ Cleaned up ${result.deletedCount} expired session(s)`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up sessions:', error);
      throw error;
    }
  }
}

module.exports = SessionManager;
