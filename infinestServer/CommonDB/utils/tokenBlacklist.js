/**
 * Token Blacklist Manager
 * Maintains a list of invalidated user IDs to prevent deleted users from accessing the system
 * even if they have valid JWT tokens
 */

// In-memory blacklist (consider using Redis in production for distributed systems)
const blacklistedUsers = new Set();

// Blacklist cleanup interval (remove entries older than 24 hours)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Store with timestamp for cleanup
const blacklistWithTimestamp = new Map();

/**
 * Add a user to the blacklist
 * @param {string} userId - User ID to blacklist
 */
function blacklistUser(userId) {
    blacklistedUsers.add(userId);
    blacklistWithTimestamp.set(userId, Date.now());
    console.log(`🚫 User ${userId} added to blacklist`);
}

/**
 * Check if a user is blacklisted
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if user is blacklisted
 */
function isUserBlacklisted(userId) {
    return blacklistedUsers.has(userId);
}

/**
 * Remove a user from the blacklist (for testing purposes)
 * @param {string} userId - User ID to remove
 */
function removeFromBlacklist(userId) {
    blacklistedUsers.delete(userId);
    blacklistWithTimestamp.delete(userId);
    console.log(`✅ User ${userId} removed from blacklist`);
}

/**
 * Clean up old blacklist entries
 */
function cleanupBlacklist() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, timestamp] of blacklistWithTimestamp.entries()) {
        if (now - timestamp > TOKEN_MAX_AGE) {
            blacklistedUsers.delete(userId);
            blacklistWithTimestamp.delete(userId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired entries from blacklist`);
    }
}

/**
 * Get current blacklist size
 * @returns {number} - Number of blacklisted users
 */
function getBlacklistSize() {
    return blacklistedUsers.size;
}

/**
 * Get all blacklisted users (for admin purposes)
 * @returns {Array} - Array of blacklisted user IDs with timestamps
 */
function getAllBlacklistedUsers() {
    return Array.from(blacklistWithTimestamp.entries()).map(([userId, timestamp]) => ({
        userId,
        blacklistedAt: new Date(timestamp),
        expiresAt: new Date(timestamp + TOKEN_MAX_AGE)
    }));
}

// Start cleanup interval
setInterval(cleanupBlacklist, CLEANUP_INTERVAL);

console.log('🔒 Token blacklist initialized');

module.exports = {
    blacklistUser,
    isUserBlacklisted,
    removeFromBlacklist,
    getBlacklistSize,
    getAllBlacklistedUsers
};
