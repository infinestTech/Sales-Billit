const axios = require("../utils/axiosConfig"); // Use IPv4-specific axios
const crypto = require("crypto");
const { Role, User, Manager, Shop, Plan } = require("../models/mongoModels");


function generateInviteCode(length = 6) {
  return crypto.randomBytes(length).toString("base64").replace(/[^a-zA-Z0-9]/g, "").substring(0, length);
}


const syncUserToBillit = async (userId, authHeader) => {
  if (!userId) {
    throw new Error("❌ userId is required");
  }


  if (!authHeader) {
    throw new Error("❌ Authorization token is required for user sync.");
  }


  // 1️⃣ Fetch product access from auth server
  let data;
  try {
    const response = await axios.post(
  `${process.env.AUTH_SERVER_URL}/get-user-billit-access`,
      { userId },
      {
        headers: {
          Authorization: authHeader
        }
      }
    );
    data = response.data;
  } catch (authErr) {
    throw new Error("❌ Auth server error: " + (authErr?.response?.data?.message || authErr.message));
  }


  // ✅ Return subscription status instead of throwing error
  // Let the calling route handle the expired subscription message
  if (!data.hasAccess) {
    return { 
      success: false, 
      hasAccess: false,
      subscriptionExpired: true,
      message: "Subscription access denied"
    };
  }


  const mongoPlanId = data.mongoPlanId;
  if (!mongoPlanId) {
    throw new Error("❌ mongoPlanId missing in auth server response.");
  }


  // 2️⃣ Get MongoDB Plan
  let mongoPlan;
  try {
    mongoPlan = await Plan.findOne({ _id: mongoPlanId }).populate("category_id");
  } catch (planErr) {
    throw new Error("❌ Failed to fetch plan from MongoDB: " + planErr.message);
  }


  if (!mongoPlan) {
    throw new Error("❌ Plan not found in MongoDB.");
  }


  const category = mongoPlan.category_id;
  if (!category) {
    throw new Error("❌ Plan category is missing or not populated.");
  }


  const mongoCategoryId = category._id;
  const categoryName = category.name;
  const isManager = categoryName === "Manager";


  // 3️⃣ Create or update Role
  let role;
  try {
    const roleData = {
      mysql_user_id: userId,
      role: isManager ? "manager" : "shop_owner",
      shop_type: "separate_shop",
      mongoPlanId,
      mongoCategoryId,
      isComplete: false,
      created_at: new Date()
    };


    role = await Role.findOneAndUpdate(
      { mysql_user_id: userId },
      roleData,
      { upsert: true, new: true }
    );
  } catch (roleErr) {
    throw new Error("❌ Failed to create/update Role: " + roleErr.message);
  }


  // 4️⃣ Create or update User
  try {
    const userData = {
      mysql_user_id: userId,
      role_id: role._id,
      isSubscriptionActive: true,
      created_at: new Date()
    };


    await User.findOneAndUpdate(
      { mysql_user_id: userId },
      userData,
      { upsert: true }
    );
  } catch (userErr) {
    throw new Error("❌ Failed to create/update User: " + userErr.message);
  }


  // 5️⃣ Create/update Manager or Shop
  if (isManager) {
    try {
      const invite_code = generateInviteCode();
      const branch_limit = mongoPlan.branchLimit || 1;


      await Manager.findOneAndUpdate(
        { mysql_user_id: userId },
        {
          mysql_user_id: userId,
          plan_id: mongoPlanId,
          branch_limit,
          invite_code,
          created_at: new Date()
        },
        { upsert: true }
      );
    } catch (managerErr) {
      throw new Error("❌ Failed to create/update Manager: " + managerErr.message);
    }
  } else {
    try {
      let mysqlUser;
      try {
        const response = await axios.post(
          `${process.env.AUTH_SERVER_URL}/get-mysql-user`,
          { userId },
          { headers: { Authorization: authHeader } }
        );
        mysqlUser = response.data;
      } catch (mysqlErr) {
        throw new Error("❌ Failed to fetch MySQL user data: " + (mysqlErr?.response?.data?.message || mysqlErr.message));
      }


      const shopData = {
        mysql_user_id: userId,
        role_id: role._id,
        shop_name: mysqlUser.name ? `${mysqlUser.name}'s Shop` : "Shop",
        location: mysqlUser.location || "Location Not Set",
        category: categoryName,
        owner_name: mysqlUser.name || "",    // ✅ Insert MySQL `name` as `owner_name`
        phone: mysqlUser.phone || "",            // ✅ Insert MySQL `phone`
        email: mysqlUser.email || "",            // ✅ Insert MySQL `email` if your Shop schema includes it
        created_at: new Date()
      };


      await Shop.findOneAndUpdate(
        { mysql_user_id: userId },
        shopData,
        { upsert: true }
      );
    } catch (shopErr) {
      throw new Error("❌ Failed to create/update Shop: " + shopErr.message);
    }
  }


  return { 
    success: true,
    message: "✅ User synced to MongoDB successfully." 
  };
};


module.exports = { syncUserToBillit };




