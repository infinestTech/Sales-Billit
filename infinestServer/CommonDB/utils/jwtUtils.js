const jwt = require("jsonwebtoken");

const createJWT = (payload, expiresIn = "7d") => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

module.exports = { createJWT };
