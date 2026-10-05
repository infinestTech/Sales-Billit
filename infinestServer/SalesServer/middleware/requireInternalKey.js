// Guards server-to-server endpoints (BillitServer → SalesServer) with the shared INTERNAL_API_KEY.
module.exports = function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!process.env.INTERNAL_API_KEY || !key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};
