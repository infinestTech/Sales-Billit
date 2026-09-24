const crypto = require("crypto");
const { Mobile } = require("../../models/mongoModels");
const r2 = require("../../utils/r2Storage");

const ALLOWED_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SIDES = ["front", "back"];
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_URL_TTL = 300;

const keyPrefixForShop = (shopId) => `mobiles/${shopId}/`;

// Keeps only well-formed image refs that were uploaded under this shop's prefix
function sanitizeMobileImages(images, shopId) {
  if (!Array.isArray(images) || !shopId) return [];
  const prefix = keyPrefixForShop(String(shopId));
  const seen = new Set();
  const out = [];
  for (const img of images) {
    if (!img || typeof img.key !== "string" || !SIDES.includes(img.side)) continue;
    if (!img.key.startsWith(prefix) || img.key.includes("..") || seen.has(img.side)) continue;
    seen.add(img.side);
    out.push({ key: img.key, side: img.side, uploaded_at: new Date() });
  }
  return out;
}

// POST /api/mobile-images/presign-upload  { side, contentType, size }
const presignMobileImageUpload = async (req, res) => {
  try {
    if (!r2.isConfigured()) {
      return res.status(503).json({ error: "Image storage is not configured." });
    }
    const shopId = req.user?.shop_id;
    if (!shopId) return res.status(400).json({ error: "Shop not found in token." });

    const { side, contentType } = req.body || {};
    const size = Number(req.body?.size);
    if (!SIDES.includes(side)) return res.status(400).json({ error: "side must be 'front' or 'back'." });
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) return res.status(400).json({ error: "Only JPEG, PNG or WEBP images are allowed." });
    if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
      return res.status(400).json({ error: "Image must be under 5MB." });
    }

    const key = `${keyPrefixForShop(shopId)}${crypto.randomUUID()}-${side}.${ext}`;
    const uploadUrl = await r2.getSignedUploadUrl(key, contentType, size, UPLOAD_URL_TTL);

    return res.json({ success: true, key, side, uploadUrl, expiresIn: UPLOAD_URL_TTL });
  } catch (error) {
    console.error("presignMobileImageUpload error:", error);
    return res.status(500).json({ error: "Failed to prepare image upload." });
  }
};

// GET /api/mobile-images/:mobileId  -> short-lived signed URLs
const getMobileImages = async (req, res) => {
  try {
    const { mobileId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(mobileId)) {
      return res.status(400).json({ error: "Invalid mobile id." });
    }
    const mobile = await Mobile.findOne({ _id: mobileId, shop_id: req.user?.shop_id })
      .select("images")
      .lean();
    if (!mobile) return res.status(404).json({ error: "Mobile not found." });

    const images = await Promise.all(
      (mobile.images || []).map(async (img) => ({
        side: img.side,
        uploaded_at: img.uploaded_at,
        url: await r2.getSignedViewUrl(img.key),
      }))
    );
    return res.json({ success: true, images, expiresIn: parseInt(process.env.R2_SIGNED_URL_TTL, 10) || 3600 });
  } catch (error) {
    console.error("getMobileImages error:", error);
    return res.status(500).json({ error: "Failed to fetch images." });
  }
};

module.exports = { presignMobileImageUpload, getMobileImages, sanitizeMobileImages };
