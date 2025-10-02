const { Customer, Dealer, Shop } = require("../../models/mongoModels");

/**
 * Generate next sequential bill number based on prefix (CUST/DEAL)
 * POST /api/next-bill-number
 */
const generateNextBillNumber = async (req, res) => {
  try {
    const { prefix, userId } = req.body;

    if (!prefix || (prefix !== "CUST" && prefix !== "DEAL")) {
      return res.status(400).json({ 
        error: "Invalid prefix. Must be 'CUST' or 'DEAL'." 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: "Shop ID (userId) is required." 
      });
    }

    // Validate shop exists
    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ 
        error: "Shop not found." 
      });
    }

    const shopId = userId;

    // Find all existing bill numbers for this shop with the given prefix
    const Model = prefix === "CUST" ? Customer : Dealer;
    const existingBills = await Model.find({ 
      shop_id: shopId,
      bill_no: { $regex: `^${prefix}-`, $exists: true, $ne: null }
    }).select("bill_no").lean();

    // Extract numeric parts and find the highest number
    let highestNumber = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`);
    
    existingBills.forEach(record => {
      if (record.bill_no) {
        const match = record.bill_no.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestNumber) {
            highestNumber = num;
          }
        }
      }
    });

    // Generate next number with zero padding (4 digits)
    const nextNumber = (highestNumber + 1).toString().padStart(4, '0');
    const billNumber = `${prefix}-${nextNumber}`;

    res.status(200).json({ 
      success: true,
      billNumber: billNumber,
      prefix: prefix,
      nextSequenceNumber: highestNumber + 1
    });

  } catch (error) {
    console.error("Error generating bill number:", error);
    res.status(500).json({ 
      error: "Failed to generate bill number. Please try again." 
    });
  }
};

/**
 * Check if a bill number already exists for the current shop
 * POST /api/check-bill-number
 */
const checkBillNumberExists = async (req, res) => {
  try {
    const { billNumber, userId } = req.body;

    if (!billNumber || typeof billNumber !== 'string') {
      return res.status(400).json({ 
        error: "Bill number is required and must be a string." 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: "Shop ID (userId) is required." 
      });
    }

    // Validate shop exists
    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ 
        error: "Shop not found." 
      });
    }

    const shopId = userId;

    // Check in both Customer and Dealer collections for the same shop
    const [customerExists, dealerExists] = await Promise.all([
      Customer.findOne({ 
        shop_id: shopId, 
        bill_no: billNumber.trim() 
      }).select("_id").lean(),
      Dealer.findOne({ 
        shop_id: shopId, 
        bill_no: billNumber.trim() 
      }).select("_id").lean()
    ]);

    const exists = !!(customerExists || dealerExists);

    res.status(200).json({ 
      success: true,
      exists: exists,
      billNumber: billNumber.trim(),
      foundIn: exists ? (customerExists ? 'customer' : 'dealer') : null
    });

  } catch (error) {
    console.error("Error checking bill number:", error);
    res.status(500).json({ 
      error: "Failed to check bill number. Please try again." 
    });
  }
};

module.exports = {
  generateNextBillNumber,
  checkBillNumberExists
};