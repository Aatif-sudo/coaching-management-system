const express = require("express");
const { randomUUID } = require("crypto");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination } = require("./helpers");
const { formatMoney, toMoneyNumber, sumPayments } = require("../utils/money");
const {
  createAuditLog,
  parseSchedule,
  getStudentFeeWithPayments,
  calculateDueAmount,
  nextDueInstallment,
  generateReceiptPdf
} = require("../services");

const router = express.Router();

function serializeStudentFee(row) {
  const paid = sumPayments(row.payments || []);
  const dueAmount = Math.max(toMoneyNumber(row.total_fee) - toMoneyNumber(row.discount) - paid, 0);
  return {
    id: row.id,
    student_id: row.student_id,
    batch_id: row.batch_id,
    fee_plan_id: row.fee_plan_id,
    total_fee: formatMoney(row.total_fee),
    discount: formatMoney(row.discount),
    due_schedule: parseSchedule(row.due_schedule_json),
    paid_amount: formatMoney(paid),
    due_amount: formatMoney(dueAmount),
    created_at: row.created_at
  };
}

router.post("/fees/plans", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const result = await db.run(
    `INSERT INTO fee_plans (institute_id, name, type, amount, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.name,
      req.body.type,
      req.body.amount,
      req.body.metadata_json ? JSON.stringify(req.body.metadata_json) : null
    ]
  );
  const row = await db.get("SELECT * FROM fee_plans WHERE id = ?", [result.lastID]);
  row.metadata_json = row.metadata_json ? JSON.parse(row.metadata_json) : null;
  res.status(201).json(row);
});

router.get("/fees/plans", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const rows = await db.all("SELECT * FROM fee_plans WHERE institute_id = ? ORDER BY created_at DESC", [req.user.institute_id]);
  res.json(rows.map((row) => ({ ...row, metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null })));
});

router.patch("/fees/plans/:planId", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const planId = Number(req.params.planId);
  const plan = await db.get("SELECT id FROM fee_plans WHERE id = ? AND institute_id = ?", [planId, req.user.institute_id]);
  if (!plan) {
    return res.status(404).json({ detail: "Fee plan not found" });
  }
  const updates = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(updates, "metadata_json")) {
    updates.metadata_json = updates.metadata_json ? JSON.stringify(updates.metadata_json) : null;
  }
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
  if (Object.keys(updates).length) {
    const setSql = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    await db.run(`UPDATE fee_plans SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      ...Object.values(updates),
      planId
    ]);
  }
  const row = await db.get("SELECT * FROM fee_plans WHERE id = ?", [planId]);
  row.metadata_json = row.metadata_json ? JSON.parse(row.metadata_json) : null;
  res.json(row);
});

router.delete("/fees/plans/:planId", requireRoles("ADMIN"), async (req, res) => {
  const db = await connectDb();
  const planId = Number(req.params.planId);
  const row = await db.get("SELECT id FROM fee_plans WHERE id = ? AND institute_id = ?", [planId, req.user.institute_id]);
  if (!row) {
    return res.status(404).json({ detail: "Fee plan not found" });
  }
  await db.run("DELETE FROM fee_plans WHERE id = ?", [planId]);
  res.status(204).send();
});

router.patch("/fees/batches/:batchId/plan", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const batchId = Number(req.params.batchId);
  const feePlanId = Number(req.query.fee_plan_id || req.body.fee_plan_id);
  const batch = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [batchId, req.user.institute_id]);
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  const plan = await db.get("SELECT id FROM fee_plans WHERE id = ? AND institute_id = ?", [feePlanId, req.user.institute_id]);
  if (!plan) {
    return res.status(404).json({ detail: "Fee plan not found" });
  }
  await db.run("UPDATE batches SET fee_plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [feePlanId, batchId]);
  res.json({ batch_id: batchId, fee_plan_id: feePlanId });
});

router.post("/fees/student-fees", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const student = await db.get("SELECT id FROM students WHERE id = ? AND institute_id = ?", [req.body.student_id, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student not found" });
  }
  const batch = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [req.body.batch_id, req.user.institute_id]);
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  const link = await db.get("SELECT id FROM student_batches WHERE student_id = ? AND batch_id = ?", [req.body.student_id, req.body.batch_id]);
  if (!link) {
    return res.status(400).json({ detail: "Student must be assigned to batch before fee mapping" });
  }
  const existing = await db.get(
    "SELECT id FROM student_fees WHERE student_id = ? AND batch_id = ? AND institute_id = ?",
    [req.body.student_id, req.body.batch_id, req.user.institute_id]
  );
  if (existing) {
    return res.status(400).json({ detail: "Student fee mapping already exists" });
  }
  if (req.body.fee_plan_id) {
    const feePlan = await db.get("SELECT id FROM fee_plans WHERE id = ? AND institute_id = ?", [req.body.fee_plan_id, req.user.institute_id]);
    if (!feePlan) {
      return res.status(404).json({ detail: "Fee plan not found" });
    }
  }
  const dueSchedule = (req.body.due_schedule || []).map((item) => ({ due_date: item.due_date, amount: String(item.amount) }));
  const created = await db.run(
    `INSERT INTO student_fees (institute_id, student_id, batch_id, fee_plan_id, total_fee, discount, due_schedule_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.student_id,
      req.body.batch_id,
      req.body.fee_plan_id || null,
      req.body.total_fee,
      req.body.discount || 0,
      JSON.stringify(dueSchedule)
    ]
  );
  const row = await getStudentFeeWithPayments(db, created.lastID);
  res.status(201).json(serializeStudentFee(row));
});

router.get("/fees/student-fees", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 20);
  const params = [req.user.institute_id];
  let where = "WHERE institute_id = ?";
  if (req.query.student_id) {
    where += " AND student_id = ?";
    params.push(Number(req.query.student_id));
  }
  if (req.query.batch_id) {
    where += " AND batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    where += " AND student_id = ?";
    params.push(req.user.student_id);
  }
  const total = await db.get(`SELECT COUNT(*) AS total FROM student_fees ${where}`, params);
  const rows = await db.all(
    `SELECT * FROM student_fees ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const items = [];
  for (const row of rows) {
    items.push(serializeStudentFee(await getStudentFeeWithPayments(db, row.id)));
  }
  res.json({ total: total.total, page, page_size: pageSize, items });
});

router.post("/fees/payments", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const studentFee = await getStudentFeeWithPayments(db, req.body.student_fee_id);
  if (!studentFee || studentFee.institute_id !== req.user.institute_id) {
    return res.status(404).json({ detail: "Student fee mapping not found" });
  }
  const due = calculateDueAmount(studentFee);
  if (toMoneyNumber(req.body.amount) > due) {
    return res.status(400).json({ detail: "Payment exceeds due amount" });
  }
  const receiptNo = `RCPT-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const created = await db.run(
    `INSERT INTO payments (institute_id, student_fee_id, amount, paid_on, mode, receipt_no, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.student_fee_id,
      req.body.amount,
      req.body.paid_on,
      req.body.mode,
      receiptNo,
      req.body.remarks || null,
      req.user.id
    ]
  );
  await createAuditLog(db, {
    instituteId: req.user.institute_id,
    actorUserId: req.user.id,
    action: "FEE_PAYMENT_CREATED",
    entity: "payment",
    entityId: created.lastID,
    before: null,
    after: {
      student_fee_id: req.body.student_fee_id,
      amount: formatMoney(req.body.amount),
      mode: req.body.mode,
      receipt_no: receiptNo
    }
  });
  const payment = await db.get("SELECT * FROM payments WHERE id = ?", [created.lastID]);
  res.status(201).json(payment);
});

router.get("/fees/payments", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 20);
  const params = [req.user.institute_id];
  let where = "WHERE p.institute_id = ?";
  if (req.query.student_fee_id) {
    where += " AND p.student_fee_id = ?";
    params.push(Number(req.query.student_fee_id));
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    where += " AND sf.student_id = ?";
    params.push(req.user.student_id);
  }
  const total = await db.get(
    `SELECT COUNT(*) AS total FROM payments p JOIN student_fees sf ON sf.id = p.student_fee_id ${where}`,
    params
  );
  const items = await db.all(
    `SELECT p.* FROM payments p JOIN student_fees sf ON sf.id = p.student_fee_id ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ total: total.total, page, page_size: pageSize, items });
});

router.get("/fees/payments/:paymentId/receipt", requireAuth, async (req, res) => {
  const db = await connectDb();
  const payment = await db.get("SELECT * FROM payments WHERE id = ? AND institute_id = ?", [
    Number(req.params.paymentId),
    req.user.institute_id
  ]);
  if (!payment) {
    return res.status(404).json({ detail: "Payment not found" });
  }
  const studentFee = await db.get("SELECT * FROM student_fees WHERE id = ?", [payment.student_fee_id]);
  const student = await db.get("SELECT * FROM students WHERE id = ?", [studentFee.student_id]);
  const batch = await db.get("SELECT * FROM batches WHERE id = ?", [studentFee.batch_id]);
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    if (studentFee.student_id !== req.user.student_id) {
      return res.status(403).json({ detail: "Not allowed" });
    }
  }
  const pdf = await generateReceiptPdf({ payment, studentFee, student, batch });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=receipt-${payment.receipt_no}.pdf`);
  res.send(pdf);
});

router.get("/fees/dues", requireAuth, async (req, res) => {
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
  const rows = await db.all(`SELECT * FROM student_fees ${where}`, params);
  const results = [];
  for (const row of rows) {
    const full = await getStudentFeeWithPayments(db, row.id);
    const dueAmount = calculateDueAmount(full);
    if (dueAmount <= 0) {
      continue;
    }
    const student = await db.get("SELECT full_name FROM students WHERE id = ?", [row.student_id]);
    const batch = await db.get("SELECT name FROM batches WHERE id = ?", [row.batch_id]);
    const { nextDueDate, upcomingAmount } = nextDueInstallment(full);
    if (req.query.due_from && nextDueDate && nextDueDate < req.query.due_from) {
      continue;
    }
    if (req.query.due_to && nextDueDate && nextDueDate > req.query.due_to) {
      continue;
    }
    results.push({
      student_fee_id: row.id,
      student_id: row.student_id,
      student_name: student?.full_name || "",
      batch_id: row.batch_id,
      batch_name: batch?.name || "",
      total_fee: formatMoney(row.total_fee),
      discount: formatMoney(row.discount),
      paid_amount: formatMoney(sumPayments(full.payments || [])),
      due_amount: formatMoney(dueAmount),
      next_due_date: nextDueDate,
      upcoming_due_amount: upcomingAmount == null ? null : formatMoney(upcomingAmount)
    });
  }
  res.json(results);
});

module.exports = router;
