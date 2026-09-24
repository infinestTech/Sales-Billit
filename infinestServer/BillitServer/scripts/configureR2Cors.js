// Applies the CORS policy browsers need for presigned PUT/GET against the R2 bucket.
// Usage: node scripts/configureR2Cors.js   (needs an R2 token with bucket admin permission)
require("dotenv").config();
const { PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");
const { getClient } = require("../utils/r2Storage");

const origins = (process.env.R2_CORS_ORIGINS || [process.env.FRONTEND_URL, "http://localhost:3000"].filter(Boolean).join(","))
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

(async () => {
  const Bucket = process.env.R2_BUCKET_NAME;
  await getClient().send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...new Set(origins)],
            AllowedMethods: ["GET", "PUT"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  const current = await getClient().send(new GetBucketCorsCommand({ Bucket }));
  console.log(`CORS applied to ${Bucket}:`, JSON.stringify(current.CORSRules, null, 2));
})().catch((err) => {
  console.error("Failed to apply CORS:", err.name, err.message);
  process.exit(1);
});
