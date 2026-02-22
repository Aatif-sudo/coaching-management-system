const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { connectDb } = require("./db");

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

function verifyPassword(password, packedHash) {
  const raw = String(packedHash || "");
  if (raw.startsWith("$2a$") || raw.startsWith("$2b$") || raw.startsWith("$2y$")) {
    return bcrypt.compareSync(password, raw);
  }
  const [salt, expected] = raw.split(":");
  if (!salt || !expected) {
    return false;
  }
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function createToken(user, tokenType, expiresInMinutes) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      type: tokenType
    },
    config.secretKey,
    {
      algorithm: config.algorithm,
      expiresIn: `${expiresInMinutes}m`
    }
  );
}

function issueTokenPair(user) {
  return {
    access_token: createToken(user, "access", config.accessTokenExpireMinutes),
    refresh_token: createToken(user, "refresh", config.refreshTokenExpireMinutes),
    token_type: "bearer"
  };
}

function unauthorized(res, detail = "Could not validate credentials") {
  return res.status(401).json({ detail });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized(res);
  }
  const token = authHeader.slice("Bearer ".length);
  let payload;
  try {
    payload = jwt.verify(token, config.secretKey, { algorithms: [config.algorithm] });
  } catch (error) {
    return unauthorized(res);
  }
  if (payload.type !== "access" || !payload.sub) {
    return unauthorized(res);
  }
  const db = await connectDb();
  const user = await db.get("SELECT * FROM users WHERE id = ?", [Number(payload.sub)]);
  if (!user || !user.is_active) {
    return unauthorized(res, "Inactive user");
  }
  req.user = user;
  next();
}

function requireRoles(...roles) {
  return async (req, res, next) => {
    await requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ detail: "Insufficient permissions" });
      }
      return next();
    });
  };
}

function decodeRefreshToken(token) {
  const payload = jwt.verify(token, config.secretKey, { algorithms: [config.algorithm] });
  if (payload.type !== "refresh" || !payload.sub) {
    throw new Error("invalid refresh");
  }
  return payload;
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueTokenPair,
  requireAuth,
  requireRoles,
  decodeRefreshToken
};
