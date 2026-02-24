const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination } = require("./helpers");

const router = express.Router();

router.post("/batches", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const result = await db.run(
    `INSERT INTO batches (institute_id, name, course, schedule, teacher_id, start_date, end_date, fee_plan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.name,
      req.body.course,
      req.body.schedule,
      req.body.teacher_id || null,
      req.body.start_date,
      req.body.end_date || null,
      req.body.fee_plan_id || null
    ]
  );
  const row = await db.get("SELECT * FROM batches WHERE id = ?", [result.lastID]);
  res.status(201).json(row);
});

router.get("/batches", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 10);
  const params = [req.user.institute_id];
  let joinSql = "";
  let where = "WHERE b.institute_id = ?";
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile not linked" });
    }
    joinSql = "JOIN student_batches sb ON sb.batch_id = b.id";
    where += " AND sb.student_id = ?";
    params.push(req.user.student_id);
  }
  if (req.query.search) {
    where += " AND b.name LIKE ?";
    params.push(`%${req.query.search}%`);
  }
  const total = await db.get(
    `SELECT COUNT(*) as total FROM (SELECT DISTINCT b.id FROM batches b ${joinSql} ${where}) x`,
    params
  );
  const rows = await db.all(
    `SELECT DISTINCT b.* FROM batches b ${joinSql} ${where}
     ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ total: total.total, page, page_size: pageSize, items: rows });
});

router.get("/batches/:batchId", requireAuth, async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  let row;
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile not linked" });
    }
    row = await db.get(
      `SELECT b.* FROM batches b
       JOIN student_batches sb ON sb.batch_id = b.id
       WHERE b.id = ? AND b.institute_id = ? AND sb.student_id = ?`,
      [batchId, req.user.institute_id, req.user.student_id]
    );
  } else {
    row = await db.get("SELECT * FROM batches WHERE id = ? AND institute_id = ?", [batchId, req.user.institute_id]);
  }
  if (!row) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  res.json(row);
});

router.patch("/batches/:batchId", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  const exists = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [batchId, req.user.institute_id]);
  if (!exists) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  const updates = { ...req.body };
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
  if (Object.keys(updates).length) {
    const setSql = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    await db.run(`UPDATE batches SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      ...Object.values(updates),
      batchId
    ]);
  }
  const updated = await db.get("SELECT * FROM batches WHERE id = ?", [batchId]);
  res.json(updated);
});

router.delete("/batches/:batchId", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  const exists = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [batchId, req.user.institute_id]);
  if (!exists) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  await db.run("DELETE FROM batches WHERE id = ?", [batchId]);
  res.status(204).send();
});

router.get("/batches/:batchId/students", requireAuth, async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  const batch = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [batchId, req.user.institute_id]);
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  const rows = await db.all(
    `SELECT s.id, s.full_name, s.phone, s.email
     FROM students s JOIN student_batches sb ON sb.student_id = s.id
     WHERE sb.batch_id = ? AND s.institute_id = ? ORDER BY s.full_name ASC`,
    [batchId, req.user.institute_id]
  );
  res.json(rows);
});

router.get("/batches/:batchId/schedule", requireAuth, async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  const batch = await db.get(
    `SELECT b.*, u.full_name AS teacher_name
     FROM batches b LEFT JOIN users u ON u.id = b.teacher_id
     WHERE b.id = ? AND b.institute_id = ?`,
    [batchId, req.user.institute_id]
  );
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  if (req.user.role === "STUDENT") {
    const link = await db.get("SELECT id FROM student_batches WHERE batch_id = ? AND student_id = ?", [
      batchId,
      req.user.student_id
    ]);
    if (!link) {
      return res.status(403).json({ detail: "Not allowed" });
    }
  }
  res.json({
    batch_id: batch.id,
    name: batch.name,
    course: batch.course,
    schedule: batch.schedule,
    teacher_name: batch.teacher_name,
    start_date: batch.start_date,
    end_date: batch.end_date
  });
});

module.exports = router;
