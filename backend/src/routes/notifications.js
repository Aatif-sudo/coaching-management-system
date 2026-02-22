const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination } = require("./helpers");
const { runFeeReminders } = require("../services");

const router = express.Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 20);
  const params = [req.user.institute_id];
  let where = "WHERE institute_id = ?";
  if (req.query.type) {
    where += " AND type = ?";
    params.push(req.query.type);
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    const links = await db.all("SELECT batch_id FROM student_batches WHERE student_id = ?", [req.user.student_id]);
    const batchIds = links.map((item) => item.batch_id);
    let clause = "(student_id = ? OR (student_id IS NULL AND batch_id IS NULL)";
    params.push(req.user.student_id);
    if (batchIds.length) {
      clause += ` OR (student_id IS NULL AND batch_id IN (${batchIds.map(() => "?").join(",")}))`;
      params.push(...batchIds);
    }
    clause += ")";
    where += ` AND ${clause}`;
  }
  const total = await db.get(`SELECT COUNT(*) as total FROM notifications ${where}`, params);
  const rows = await db.all(
    `SELECT * FROM notifications ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({
    total: total.total,
    page,
    page_size: pageSize,
    items: rows.map((row) => ({ ...row, meta_json: row.meta_json ? JSON.parse(row.meta_json) : null }))
  });
});

router.patch("/notifications/:notificationId/read", requireAuth, async (req, res) => {
  const db = await connectDb();
  const notificationId = Number(req.params.notificationId);
  const notification = await db.get("SELECT * FROM notifications WHERE id = ? AND institute_id = ?", [notificationId, req.user.institute_id]);
  if (!notification) {
    return res.status(404).json({ detail: "Notification not found" });
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    const links = await db.all("SELECT batch_id FROM student_batches WHERE student_id = ?", [req.user.student_id]);
    const batchSet = new Set(links.map((item) => item.batch_id));
    const allowed =
      notification.student_id === req.user.student_id ||
      (notification.student_id == null && notification.batch_id == null) ||
      (notification.student_id == null && notification.batch_id != null && batchSet.has(notification.batch_id));
    if (!allowed) {
      return res.status(403).json({ detail: "Not allowed" });
    }
  }
  await db.run("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?", [notificationId]);
  const updated = await db.get("SELECT * FROM notifications WHERE id = ?", [notificationId]);
  res.json({ ...updated, meta_json: updated.meta_json ? JSON.parse(updated.meta_json) : null });
});

router.post("/notifications/announcements", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const created = await db.run(
    `INSERT INTO notifications (institute_id, student_id, batch_id, type, message)
     VALUES (?, ?, ?, 'ANNOUNCEMENT', ?)`,
    [req.user.institute_id, req.body.student_id || null, req.body.batch_id || null, req.body.message]
  );
  const row = await db.get("SELECT * FROM notifications WHERE id = ?", [created.lastID]);
  res.status(201).json({ ...row, meta_json: null });
});

router.post("/notifications/reminder-rules", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const created = await db.run(
    `INSERT INTO reminder_rules (institute_id, batch_id, name, days_before, on_due_date, every_n_days_after_due, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.batch_id || null,
      req.body.name,
      req.body.days_before,
      req.body.on_due_date ? 1 : 0,
      req.body.every_n_days_after_due,
      req.body.is_active == null ? 1 : req.body.is_active ? 1 : 0
    ]
  );
  const rule = await db.get("SELECT * FROM reminder_rules WHERE id = ?", [created.lastID]);
  rule.on_due_date = Boolean(rule.on_due_date);
  rule.is_active = Boolean(rule.is_active);
  res.status(201).json(rule);
});

router.get("/notifications/reminder-rules", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const rows = await db.all("SELECT * FROM reminder_rules WHERE institute_id = ? ORDER BY created_at DESC", [req.user.institute_id]);
  res.json(rows.map((row) => ({ ...row, on_due_date: Boolean(row.on_due_date), is_active: Boolean(row.is_active) })));
});

router.patch("/notifications/reminder-rules/:ruleId", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const ruleId = Number(req.params.ruleId);
  const row = await db.get("SELECT id FROM reminder_rules WHERE id = ? AND institute_id = ?", [ruleId, req.user.institute_id]);
  if (!row) {
    return res.status(404).json({ detail: "Rule not found" });
  }
  const updates = { ...req.body };
  if (updates.on_due_date !== undefined) {
    updates.on_due_date = updates.on_due_date ? 1 : 0;
  }
  if (updates.is_active !== undefined) {
    updates.is_active = updates.is_active ? 1 : 0;
  }
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
  if (Object.keys(updates).length) {
    const setSql = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    await db.run(`UPDATE reminder_rules SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      ...Object.values(updates),
      ruleId
    ]);
  }
  const updated = await db.get("SELECT * FROM reminder_rules WHERE id = ?", [ruleId]);
  updated.on_due_date = Boolean(updated.on_due_date);
  updated.is_active = Boolean(updated.is_active);
  res.json(updated);
});

router.delete("/notifications/reminder-rules/:ruleId", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const ruleId = Number(req.params.ruleId);
  const row = await db.get("SELECT id FROM reminder_rules WHERE id = ? AND institute_id = ?", [ruleId, req.user.institute_id]);
  if (!row) {
    return res.status(404).json({ detail: "Rule not found" });
  }
  await db.run("DELETE FROM reminder_rules WHERE id = ?", [ruleId]);
  res.status(204).send();
});

router.post("/notifications/run-reminders", requireRoles("ADMIN", "TEACHER"), async (_req, res) => {
  const created = await runFeeReminders(new Date().toISOString().slice(0, 10));
  res.json({ created_notifications: created });
});

router.get("/notifications/:notificationId/whatsapp-template", requireAuth, async (req, res) => {
  const db = await connectDb();
  const row = await db.get("SELECT * FROM notifications WHERE id = ? AND institute_id = ?", [Number(req.params.notificationId), req.user.institute_id]);
  if (!row) {
    return res.status(404).json({ detail: "Notification not found" });
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    const links = await db.all("SELECT batch_id FROM student_batches WHERE student_id = ?", [req.user.student_id]);
    const batchSet = new Set(links.map((item) => item.batch_id));
    const allowed =
      row.student_id === req.user.student_id ||
      (row.student_id == null && row.batch_id == null) ||
      (row.student_id == null && row.batch_id != null && batchSet.has(row.batch_id));
    if (!allowed) {
      return res.status(403).json({ detail: "Not allowed" });
    }
  }
  const meta = row.meta_json ? JSON.parse(row.meta_json) : {};
  res.json({ template: meta.whatsapp_template || row.message });
});

module.exports = router;
