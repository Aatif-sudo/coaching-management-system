const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles, verifyPassword, hashPassword, issueTokenPair, decodeRefreshToken } = require("../auth");
const { userResponse } = require("./helpers");

const router = express.Router();

router.post("/auth/register", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const existing = await db.get("SELECT id FROM users WHERE email = ?", [req.body.email]);
  if (existing) {
    return res.status(400).json({ detail: "Email already registered" });
  }
  const result = await db.run(
    `INSERT INTO users (institute_id, full_name, email, phone, password_hash, role, student_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.full_name,
      req.body.email,
      req.body.phone || null,
      hashPassword(req.body.password),
      req.body.role,
      req.body.student_id || null,
      req.body.is_active == null ? 1 : req.body.is_active ? 1 : 0
    ]
  );
  const user = await db.get("SELECT * FROM users WHERE id = ?", [result.lastID]);
  res.json(userResponse(user));
});

router.post("/auth/login", async (req, res) => {
  const db = await connectDb();
  const user = await db.get("SELECT * FROM users WHERE email = ?", [req.body.email]);
  if (!user || !verifyPassword(req.body.password || "", user.password_hash)) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }
  if (!user.is_active) {
    return res.status(403).json({ detail: "User is disabled" });
  }
  res.json(issueTokenPair(user));
});

router.post("/auth/refresh", async (req, res) => {
  let payload;
  try {
    payload = decodeRefreshToken(req.body.refresh_token);
  } catch (_error) {
    return res.status(401).json({ detail: "Invalid refresh token" });
  }
  const db = await connectDb();
  const user = await db.get("SELECT * FROM users WHERE id = ?", [Number(payload.sub)]);
  if (!user || !user.is_active) {
    return res.status(401).json({ detail: "Invalid refresh token" });
  }
  res.json(issueTokenPair(user));
});

router.get("/auth/me", requireAuth, async (req, res) => {
  res.json(userResponse(req.user));
});

module.exports = router;
