const axios = require('axios').create({ family: 4, timeout: 10000 });
const { SalesUser } = require('../models/salesModels');

const syncSalesUser = async (userId, authHeader) => {
  if (!userId) throw new Error('userId required');
  if (!authHeader) throw new Error('Authorization header required');

  // Verify access for SALES product
  let data;
  try {
    const res = await axios.post(`${process.env.AUTH_SERVER_URL}/get-user-sales-access`, {}, {
      headers: { Authorization: authHeader }
    });
    data = res.data;
  } catch (err) {
    throw new Error('Auth server error: ' + (err?.response?.data?.message || err.message));
  }

  if (!data.hasAccess) {
    throw new Error('User does not have active SALES subscription.');
  }

  // Create or update SalesUser in Mongo
  await SalesUser.findOneAndUpdate(
    { mysql_user_id: userId },
    { mysql_user_id: userId, product: 'SALES', isSubscriptionActive: true },
    { upsert: true }
  );

  return { message: 'Sales user synced to Mongo' };
};

module.exports = { syncSalesUser };
