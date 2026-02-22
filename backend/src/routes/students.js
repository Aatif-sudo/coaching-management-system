const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination, serializeStudent } = require("./helpers");

const router = express.Router();

router.post("/students", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const batchIds = [...new Set(req.body.batch_ids || [])];
  if (batchIds.length) {
    const found = await db.all(
      `SELECT id FROM batches WHERE institute_id = ? AND id IN (${batchIds.map(() => "?").join(",")})`,
      [req.user.institute_id, ...batchIds]
    );
    if (found.length !== batchIds.length) {
      return res.status(400).json({ detail: "One or more batches are invalid" });
    }
  }
  const created = await db.run(
    `INSERT INTO students (institute_id, full_name, phone, email, guardian_name, guardian_phone, address, join_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.full_name,
      req.body.phone || null,
      req.body.email || null,
      req.body.guardian_name || null,
      req.body.guardian_phone || null,
      req.body.address || null,
      req.body.join_date,
      req.body.status || "ACTIVE"
    ]
  );
  for (const batchId of batchIds) {
    await db.run("INSERT INTO student_batches (institute_id, student_id, batch_id) VALUES (?, ?, ?)", [
      req.user.institute_id,
      created.lastID,
      batchId
    ]);
  }
  const student = await db.get("SELECT * FROM students WHERE id = ?", [created.lastID]);
  res.status(201).json(await serializeStudent(db, student));
});

router.get("/students", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 10);
  const params = [req.user.institute_id];
  let where = "WHERE s.institute_id = ?";
  let join = "";
  if (req.query.search) {
    where += " AND s.full_name LIKE ?";
    params.push(`%${req.query.search}%`);
  }
  if (req.query.phone) {
    where += " AND s.phone LIKE ?";
    params.push(`%${req.query.phone}%`);
  }
  if (req.query.batch_id) {
    join = "JOIN student_batches sb ON sb.student_id = s.id";
    where += " AND sb.batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (String(req.query.unpaid_only).toLowerCase() === "true") {
    where += ` AND EXISTS (
      SELECT 1 FROM student_fees sf LEFT JOIN payments p ON p.student_fee_id = sf.id
      WHERE sf.student_id = s.id AND sf.institute_id = s.institute_id
      GROUP BY sf.id HAVING (sf.total_fee - sf.discount - COALESCE(SUM(p.amount), 0)) > 0
    )`;
  }
  const total = await db.get(
    `SELECT COUNT(*) AS total FROM (SELECT DISTINCT s.id FROM students s ${join} ${where}) x`,
    params
  );
  const rows = await db.all(
    `SELECT DISTINCT s.* FROM students s ${join} ${where}
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const items = [];
  for (const row of rows) {
    items.push(await serializeStudent(db, row));
  }
  res.json({ total: total.total, page, page_size: pageSize, items });
});

router.get("/students/:studentId", requireAuth, async (req, res) => {
  const db = await connectDb();
  const studentId = Number(req.params.studentId);
  const student = await db.get("SELECT * FROM students WHERE id = ? AND institute_id = ?", [studentId, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student not found" });
  }
  if (req.user.role === "STUDENT" && req.user.student_id !== studentId) {
    return res.status(403).json({ detail: "Not allowed" });
  }
  res.json(await serializeStudent(db, student));
});

router.patch("/students/:studentId", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const studentId = Number(req.params.studentId);
  const student = await db.get("SELECT id FROM students WHERE id = ? AND institute_id = ?", [studentId, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student not found" });
  }
  const updates = { ...req.body };
  delete updates.batch_ids;
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
  if (Object.keys(updates).length) {
    const setSql = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    await db.run(`UPDATE students SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      ...Object.values(updates),
      studentId
    ]);
  }
  const updated = await db.get("SELECT * FROM students WHERE id = ?", [studentId]);
  res.json(await serializeStudent(db, updated));
});

router.patch("/students/:studentId/disable", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const studentId = Number(req.params.studentId);
  const student = await db.get("SELECT id FROM students WHERE id = ? AND institute_id = ?", [studentId, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student not found" });
  }
  await db.run("UPDATE students SET status = 'DISABLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [studentId]);
  const updated = await db.get("SELECT * FROM students WHERE id = ?", [studentId]);
  res.json(await serializeStudent(db, updated));
});

router.put("/students/:studentId/batches", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const studentId = Number(req.params.studentId);
  const student = await db.get("SELECT id FROM students WHERE id = ? AND institute_id = ?", [studentId, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student not found" });
  }
  const batchIds = [...new Set(req.body.batch_ids || [])];
  if (batchIds.length) {
    const found = await db.all(
      `SELECT id FROM batches WHERE institute_id = ? AND id IN (${batchIds.map(() => "?").join(",")})`,
      [req.user.institute_id, ...batchIds]
    );
    if (found.length !== batchIds.length) {
      return res.status(400).json({ detail: "One or more batches are invalid" });
    }
  }
  await db.run("DELETE FROM student_batches WHERE institute_id = ? AND student_id = ?", [req.user.institute_id, studentId]);
  for (const batchId of batchIds) {
    await db.run("INSERT INTO student_batches (institute_id, student_id, batch_id) VALUES (?, ?, ?)", [
      req.user.institute_id,
      studentId,
      batchId
    ]);
  }
  const updated = await db.get("SELECT * FROM students WHERE id = ?", [studentId]);
  res.json(await serializeStudent(db, updated));
});

module.exports = router;
