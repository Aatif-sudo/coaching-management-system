const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination } = require("./helpers");
const { createAuditLog, buildAttendanceCsv } = require("../services");

const router = express.Router();

router.post("/attendance/mark", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const batch = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [req.body.batch_id, req.user.institute_id]);
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  const enrolled = await db.all("SELECT student_id FROM student_batches WHERE batch_id = ? AND institute_id = ?", [
    req.body.batch_id,
    req.user.institute_id
  ]);
  const enrolledSet = new Set(enrolled.map((item) => item.student_id));
  for (const record of req.body.records || []) {
    if (!enrolledSet.has(record.student_id)) {
      return res.status(400).json({ detail: "Attendance records include students not enrolled in this batch" });
    }
  }
  const result = [];
  for (const record of req.body.records || []) {
    const existing = await db.get(
      "SELECT * FROM attendance WHERE institute_id = ? AND batch_id = ? AND date = ? AND student_id = ?",
      [req.user.institute_id, req.body.batch_id, req.body.date, record.student_id]
    );
    if (existing) {
      await db.run("UPDATE attendance SET status = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
        record.status,
        req.user.id,
        existing.id
      ]);
      await createAuditLog(db, {
        instituteId: req.user.institute_id,
        actorUserId: req.user.id,
        action: "ATTENDANCE_UPDATED",
        entity: "attendance",
        entityId: existing.id,
        before: { status: existing.status },
        after: { status: record.status }
      });
      result.push(await db.get("SELECT * FROM attendance WHERE id = ?", [existing.id]));
    } else {
      const created = await db.run(
        `INSERT INTO attendance (institute_id, batch_id, student_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.institute_id, req.body.batch_id, record.student_id, req.body.date, record.status, req.user.id]
      );
      await createAuditLog(db, {
        instituteId: req.user.institute_id,
        actorUserId: req.user.id,
        action: "ATTENDANCE_CREATED",
        entity: "attendance",
        entityId: created.lastID,
        before: null,
        after: { status: record.status }
      });
      result.push(await db.get("SELECT * FROM attendance WHERE id = ?", [created.lastID]));
    }
  }
  res.json(result);
});

router.get("/attendance/history", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 20);
  const params = [req.user.institute_id];
  let where = "WHERE institute_id = ?";
  if (req.query.batch_id) {
    where += " AND batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (req.query.student_id) {
    where += " AND student_id = ?";
    params.push(Number(req.query.student_id));
  }
  if (req.query.date_from) {
    where += " AND date >= ?";
    params.push(req.query.date_from);
  }
  if (req.query.date_to) {
    where += " AND date <= ?";
    params.push(req.query.date_to);
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    where += " AND student_id = ?";
    params.push(req.user.student_id);
  }
  const total = await db.get(`SELECT COUNT(*) as total FROM attendance ${where}`, params);
  const items = await db.all(
    `SELECT * FROM attendance ${where}
     ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ total: total.total, page, page_size: pageSize, items });
});

router.get("/attendance/stats", requireAuth, async (req, res) => {
  const db = await connectDb();
  const params = [req.user.institute_id];
  let where = "WHERE institute_id = ?";
  if (req.query.batch_id) {
    where += " AND batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (req.query.student_id) {
    where += " AND student_id = ?";
    params.push(Number(req.query.student_id));
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    where += " AND student_id = ?";
    params.push(req.user.student_id);
  }
  const rows = await db.all(
    `SELECT student_id, batch_id,
            COUNT(*) as total_classes,
            SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count
     FROM attendance ${where}
     GROUP BY student_id, batch_id`,
    params
  );
  res.json(
    rows.map((row) => {
      const total = Number(row.total_classes || 0);
      const present = Number(row.present_count || 0);
      const absent = Number(row.absent_count || 0);
      return {
        student_id: row.student_id,
        batch_id: row.batch_id,
        total_classes: total,
        present_count: present,
        absent_count: absent,
        attendance_percentage: total ? Number(((present / total) * 100).toFixed(2)) : 0
      };
    })
  );
});

router.get("/attendance/export", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const params = [req.user.institute_id];
  let where = "WHERE institute_id = ?";
  if (req.query.batch_id) {
    where += " AND batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (req.query.student_id) {
    where += " AND student_id = ?";
    params.push(Number(req.query.student_id));
  }
  if (req.query.date_from) {
    where += " AND date >= ?";
    params.push(req.query.date_from);
  }
  if (req.query.date_to) {
    where += " AND date <= ?";
    params.push(req.query.date_to);
  }
  const rows = await db.all(`SELECT * FROM attendance ${where} ORDER BY date ASC`, params);
  const csv = buildAttendanceCsv(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance_export.csv");
  res.send(csv);
});

module.exports = router;
