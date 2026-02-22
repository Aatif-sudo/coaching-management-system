const express = require("express");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { toMoneyNumber, sumPayments } = require("../utils/money");
const { getStudentFeeWithPayments, calculateDueAmount, nextDueInstallment } = require("../services");

const router = express.Router();

router.get("/dashboard/admin", requireRoles("ADMIN", "TEACHER"), async (req, res) => {
  const db = await connectDb();
  const instituteId = req.user.institute_id;
  const totalStudents = (await db.get("SELECT COUNT(*) as c FROM students WHERE institute_id = ?", [instituteId])).c;
  const totalBatches = (await db.get("SELECT COUNT(*) as c FROM batches WHERE institute_id = ?", [instituteId])).c;
  const today = new Date().toISOString().slice(0, 10);
  const todayPresent = (
    await db.get("SELECT COUNT(*) as c FROM attendance WHERE institute_id = ? AND date = ? AND status = 'PRESENT'", [instituteId, today])
  ).c;
  const feeRows = await db.all("SELECT * FROM student_fees WHERE institute_id = ?", [instituteId]);
  let unpaidStudents = 0;
  let totalDue = 0;
  const upcoming = [];
  for (const fee of feeRows) {
    const full = await getStudentFeeWithPayments(db, fee.id);
    const due = calculateDueAmount(full);
    if (due > 0) {
      unpaidStudents += 1;
      totalDue += due;
      const student = await db.get("SELECT full_name FROM students WHERE id = ?", [fee.student_id]);
      const batch = await db.get("SELECT name FROM batches WHERE id = ?", [fee.batch_id]);
      const { nextDueDate, upcomingAmount } = nextDueInstallment(full);
      upcoming.push({
        student_name: student?.full_name || "",
        batch_name: batch?.name || "",
        next_due_date: nextDueDate,
        due_amount: Number((upcomingAmount ?? due).toFixed(2))
      });
    }
  }
  const notifications = await db.all(
    "SELECT id, type, message, created_at FROM notifications WHERE institute_id = ? ORDER BY created_at DESC LIMIT 5",
    [instituteId]
  );
  res.json({
    total_students: totalStudents,
    total_batches: totalBatches,
    today_present_records: todayPresent,
    unpaid_students: unpaidStudents,
    total_due_amount: Number(totalDue.toFixed(2)),
    upcoming_dues: upcoming.slice(0, 10),
    recent_notifications: notifications
  });
});

router.get("/dashboard/student", requireAuth, async (req, res) => {
  const db = await connectDb();
  if (req.user.role !== "STUDENT" || !req.user.student_id) {
    return res.status(403).json({ detail: "Student access only" });
  }
  const student = await db.get("SELECT * FROM students WHERE id = ? AND institute_id = ?", [req.user.student_id, req.user.institute_id]);
  if (!student) {
    return res.status(404).json({ detail: "Student profile not found" });
  }
  const links = await db.all("SELECT batch_id FROM student_batches WHERE student_id = ?", [student.id]);
  const batchIds = links.map((item) => item.batch_id);
  const batches = batchIds.length
    ? await db.all(
        `SELECT b.*, u.full_name as teacher_name FROM batches b
         LEFT JOIN users u ON u.id = b.teacher_id
         WHERE b.id IN (${batchIds.map(() => "?").join(",")})`,
        batchIds
      )
    : [];
  const notes = batchIds.length
    ? await db.all(
        `SELECT id, batch_id, title, description, file_name, created_at
         FROM notes WHERE batch_id IN (${batchIds.map(() => "?").join(",")})
         ORDER BY created_at DESC LIMIT 30`,
        batchIds
      )
    : [];
  const attendanceRows = await db.all(
    `SELECT batch_id, COUNT(*) as total, SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present
     FROM attendance WHERE student_id = ? AND institute_id = ? GROUP BY batch_id`,
    [student.id, req.user.institute_id]
  );
  const fees = [];
  let totalDue = 0;
  const feeRows = await db.all("SELECT * FROM student_fees WHERE student_id = ?", [student.id]);
  for (const row of feeRows) {
    const full = await getStudentFeeWithPayments(db, row.id);
    const paid = sumPayments(full.payments || []);
    const due = calculateDueAmount(full);
    totalDue += due;
    const batch = await db.get("SELECT name FROM batches WHERE id = ?", [row.batch_id]);
    fees.push({
      student_fee_id: row.id,
      batch_name: batch?.name || "",
      total_fee: Number(toMoneyNumber(row.total_fee).toFixed(2)),
      discount: Number(toMoneyNumber(row.discount).toFixed(2)),
      paid_amount: Number(paid.toFixed(2)),
      due_amount: Number(due.toFixed(2)),
      payments: (full.payments || []).map((p) => ({
        id: p.id,
        amount: Number(toMoneyNumber(p.amount).toFixed(2)),
        date: p.paid_on,
        mode: p.mode,
        receipt_no: p.receipt_no
      }))
    });
  }
  let where = "institute_id = ? AND (student_id = ? OR (student_id IS NULL AND batch_id IS NULL)";
  const params = [req.user.institute_id, student.id];
  if (batchIds.length) {
    where += ` OR (student_id IS NULL AND batch_id IN (${batchIds.map(() => "?").join(",")}) AND type IN ('ANNOUNCEMENT', 'FEE_REMINDER'))`;
    params.push(...batchIds);
  }
  where += ")";
  const notifications = await db.all(
    `SELECT id, message, type, created_at, read_at FROM notifications
     WHERE ${where} ORDER BY created_at DESC LIMIT 30`,
    params
  );
  res.json({
    student: { id: student.id, full_name: student.full_name, status: student.status },
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      course: b.course,
      schedule: b.schedule,
      teacher_name: b.teacher_name
    })),
    attendance: attendanceRows.map((row) => ({
      batch_id: row.batch_id,
      total_classes: Number(row.total),
      present: Number(row.present || 0),
      percentage: Number(row.total) ? Number(((Number(row.present || 0) / Number(row.total)) * 100).toFixed(2)) : 0
    })),
    fees,
    total_due_amount: Number(totalDue.toFixed(2)),
    notes,
    notifications,
    generated_at: new Date().toISOString()
  });
});

module.exports = router;
