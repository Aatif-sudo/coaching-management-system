const express = require("express");
const { connectDb } = require("../db");
const { requireRoles } = require("../auth");
const { userResponse } = require("./helpers");

const router = express.Router();

router.get("/users/teachers", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const rows = await db.all(
    "SELECT * FROM users WHERE institute_id = ? AND role = 'TEACHER' AND is_active = 1",
    [req.user.institute_id]
  );
  res.json(rows.map(userResponse));
});

module.exports = router;
