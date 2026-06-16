const axios = require('axios');
const jwt = require('jsonwebtoken');

async function getMysqlUser(req, res) {
  try {
    const authUrl = process.env.AUTH_SERVER_URL || 'http://127.0.0.1:7000';

    // Prefer userId from requireUser middleware
    const userId = (req.user && req.user.userId) || null;

    // If no userId, try to extract from Bearer token by decoding (non-verified) or return error
    if (!userId) {
      const authHeader = req.headers.authorization || '';
      const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (!raw) return res.status(401).json({ success: false, message: 'Missing token' });
      try {
        const decoded = jwt.decode(raw) || {};
        if (decoded.userId) {
          // use decoded userId
          req.user = req.user || {};
          req.user.userId = decoded.userId;
        }
      } catch (_) {}
    }

    const finalUserId = (req.user && req.user.userId) || null;
    if (!finalUserId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // AUTH endpoint expects { userId } in body
    const resp = await axios.post(`${authUrl}/get-mysql-user`, { userId: finalUserId });
    // CommonDB returns fields directly (phone,name,email...), so normalize
    const user = resp.data && (resp.data.user || resp.data) ? (resp.data.user || resp.data) : null;
    return res.json({ success: true, user });
  } catch (err) {
    console.error('getMysqlUser error', err.response?.data || err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to fetch mysql user' });
  }
}

module.exports = { getMysqlUser };
