/**
 * Token Blacklist Manager for BillitServer
 * Maintains a list of invalidated MySQL user IDs to prevent deleted users from accessing the system
 */

// In-memory blacklist
const blacklistedUsers = new Set();
const blacklistWithTimestamp = new Map();

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function blacklistUser(mysqlUserId) {
    blacklistedUsers.add(mysqlUserId);
    blacklistWithTimestamp.set(mysqlUserId, Date.now());
    console.log(`🚫 User ${mysqlUserId} added to BillitServer blacklist`);
}

function isUserBlacklisted(mysqlUserId) {
    return blacklistedUsers.has(mysqlUserId);
}

function removeFromBlacklist(mysqlUserId) {
    blacklistedUsers.delete(mysqlUserId);
    blacklistWithTimestamp.delete(mysqlUserId);
    console.log(`✅ User ${mysqlUserId} removed from BillitServer blacklist`);
}

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
        console.log(`🧹 BillitServer: Cleaned ${cleanedCount} expired entries from blacklist`);
    }
}

function getBlacklistSize() {
    return blacklistedUsers.size;
}

function getAllBlacklistedUsers() {
    return Array.from(blacklistWithTimestamp.entries()).map(([userId, timestamp]) => ({
        userId,
        blacklistedAt: new Date(timestamp),
        expiresAt: new Date(timestamp + TOKEN_MAX_AGE)
    }));
}

// Start cleanup interval
setInterval(cleanupBlacklist, CLEANUP_INTERVAL);

console.log('🔒 BillitServer token blacklist initialized');

module.exports = {
    blacklistUser,
    isUserBlacklisted,
    removeFromBlacklist,
    getBlacklistSize,
    getAllBlacklistedUsers
};
