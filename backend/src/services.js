const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const { stringify } = require("csv-stringify/sync");
const config = require("./config");
const { connectDb } = require("./db");
const { formatMoney, sumPayments, toMoneyNumber } = require("./utils/money");

function ensureStorageDirs() {
  fs.mkdirSync(config.storageDir, { recursive: true });
  fs.mkdirSync(path.join(config.storageDir, "notes"), { recursive: true });
  fs.mkdirSync(path.join(config.storageDir, "receipts"), { recursive: true });
}

function resolveStoragePath(relativePath) {
  const base = path.resolve(config.storageDir);
  const resolved = path.resolve(base, relativePath);
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}

function storeNoteFile(file) {
  ensureStorageDirs();
  const ext = path.extname(file.originalname || "");
  const fileName = `${crypto.randomUUID().replace(/-/g, "")}${ext}`;
  const relativePath = path.join("notes", fileName);
  const absolutePath = path.join(config.storageDir, relativePath);
  fs.writeFileSync(absolutePath, file.buffer);
  return {
    relativePath: relativePath.replaceAll("\\", "/"),
    originalName: file.originalname || fileName,
    contentType: file.mimetype || "application/octet-stream"
  };
}

function createAuditLog(db, { instituteId, actorUserId, action, entity, entityId, before, after }) {
  return db.run(
    `INSERT INTO audit_logs (institute_id, actor_user_id, action, entity, entity_id, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      instituteId,
      actorUserId || null,
      action,
      entity,
      String(entityId),
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]
  );
}

function parseSchedule(raw) {
  try {
    const loaded = JSON.parse(raw || "[]");
    return Array.isArray(loaded) ? loaded : [];
  } catch {
    return [];
  }
}

async function getStudentFeeWithPayments(db, studentFeeId) {
  const studentFee = await db.get("SELECT * FROM student_fees WHERE id = ?", [studentFeeId]);
  if (!studentFee) {
    return null;
  }
  const payments = await db.all(
    "SELECT * FROM payments WHERE student_fee_id = ? ORDER BY created_at DESC",
    [studentFeeId]
  );
  return { ...studentFee, payments };
}

function calculateTotalDue(studentFee) {
  return Math.max(toMoneyNumber(studentFee.total_fee) - toMoneyNumber(studentFee.discount), 0);
}

function calculateDueAmount(studentFee) {
  const paid = sumPayments(studentFee.payments || []);
  return Math.max(calculateTotalDue(studentFee) - paid, 0);
}

function nextDueInstallment(studentFee) {
  const schedule = parseSchedule(studentFee.due_schedule_json);
  if (!schedule.length) {
    return { nextDueDate: null, upcomingAmount: null };
  }
  let paidRemaining = sumPayments(studentFee.payments || []);
  const sorted = [...schedule].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  for (const item of sorted) {
    const installment = toMoneyNumber(item.amount);
    const consumed = Math.min(paidRemaining, installment);
    const outstanding = installment - consumed;
    paidRemaining -= consumed;
    if (outstanding > 0) {
      return { nextDueDate: String(item.due_date), upcomingAmount: outstanding };
    }
  }
  return { nextDueDate: null, upcomingAmount: null };
}

function outstandingInstallments(studentFee) {
  const schedule = parseSchedule(studentFee.due_schedule_json);
  const sorted = [...schedule].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  let paidRemaining = sumPayments(studentFee.payments || []);
  const rows = [];
  sorted.forEach((item, idx) => {
    const installment = toMoneyNumber(item.amount);
    const consumed = Math.min(paidRemaining, installment);
    const outstanding = installment - consumed;
    paidRemaining -= consumed;
    if (outstanding > 0) {
      rows.push({
        index: idx,
        dueDate: String(item.due_date),
        amount: outstanding
      });
    }
  });
  return rows;
}

async function generateReceiptPdf({ payment, studentFee, student, batch }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(20).text("Fee Payment Receipt");
  doc.moveDown(0.8);
  doc.fontSize(11).text(`Receipt No: ${payment.receipt_no}`);
  doc.text(`Date: ${payment.paid_on}`);
  doc.moveDown(0.8);
  doc.fontSize(13).text("Student Details");
  doc.fontSize(11).text(`Name: ${student.full_name}`);
  doc.text(`Batch: ${batch.name}`);
  doc.text(`Course: ${batch.course}`);
  doc.moveDown(0.8);
  doc.fontSize(13).text("Payment Details");
  doc.fontSize(11).text(`Amount Paid: INR ${formatMoney(payment.amount)}`);
  doc.text(`Mode: ${payment.mode}`);
  doc.text(`Total Fee: INR ${formatMoney(studentFee.total_fee)}`);
  doc.text(`Discount: INR ${formatMoney(studentFee.discount)}`);
  doc.moveDown(0.8);
  doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`);
  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

function buildWhatsappTemplate(studentName, batchName, dueAmount, dueDate) {
  return `Hello ${studentName}, this is a fee reminder for ${batchName}. Amount due: ${dueAmount}. Due date: ${dueDate}. Please pay at the earliest. Thank you.`;
}

async function runFeeReminders(runDateStr) {
  const db = await connectDb();
  const runDate = new Date(runDateStr);
  const reminders = await db.all("SELECT * FROM reminder_rules WHERE is_active = 1");
  const notifications = await db.all(
    "SELECT student_id, meta_json FROM notifications WHERE type = 'FEE_REMINDER'"
  );

  const existing = new Set();
  for (const row of notifications) {
    if (!row.meta_json) {
      continue;
    }
    const meta = JSON.parse(row.meta_json);
    existing.add(`${row.student_id}|${meta.student_fee_id}|${meta.due_date}|${meta.trigger_day}`);
  }

  const studentFees = await db.all("SELECT * FROM student_fees");
  let created = 0;
  for (const fee of studentFees) {
    const payments = await db.all("SELECT * FROM payments WHERE student_fee_id = ?", [fee.id]);
    const withPayments = { ...fee, payments };
    const dueAmount = calculateDueAmount(withPayments);
    if (dueAmount <= 0) {
      continue;
    }
    const student = await db.get("SELECT * FROM students WHERE id = ?", [fee.student_id]);
    const batch = await db.get("SELECT * FROM batches WHERE id = ?", [fee.batch_id]);
    if (!student || !batch) {
      continue;
    }
    const ruleSet = reminders.filter((rule) => rule.institute_id === fee.institute_id && (rule.batch_id == null || rule.batch_id === fee.batch_id));
    const activeRules = ruleSet.length ? ruleSet : [{ days_before: 3, on_due_date: 1, every_n_days_after_due: 3 }];
    for (const installment of outstandingInstallments(withPayments)) {
      const dueDate = new Date(installment.dueDate);
      const deltaDays = Math.floor((dueDate.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
      for (const rule of activeRules) {
        let trigger = null;
        if (deltaDays === Number(rule.days_before || 0)) {
          trigger = "before_due";
        } else if (deltaDays === 0 && Number(rule.on_due_date || 0) === 1) {
          trigger = "on_due";
        } else if (deltaDays < 0) {
          const n = Math.max(Number(rule.every_n_days_after_due || 1), 1);
          if (Math.abs(deltaDays) % n === 0) {
            trigger = "after_due";
          }
        }
        if (!trigger) {
          continue;
        }
        const key = `${student.id}|${fee.id}|${installment.dueDate}|${runDateStr}`;
        if (existing.has(key)) {
          continue;
        }
        const message = `Fee reminder: ${student.full_name}, installment ${installment.index + 1} for batch ${batch.name} is due ${installment.dueDate}. Pending installment amount: INR ${formatMoney(installment.amount)}. Total pending: INR ${formatMoney(dueAmount)}.`;
        const meta = JSON.stringify({
          student_fee_id: fee.id,
          batch_id: fee.batch_id,
          due_date: installment.dueDate,
          trigger,
          trigger_day: runDateStr,
          whatsapp_template: buildWhatsappTemplate(
            student.full_name,
            batch.name,
            `INR ${formatMoney(installment.amount)}`,
            installment.dueDate
          )
        });
        await db.run(
          `INSERT INTO notifications (institute_id, student_id, batch_id, type, message, meta_json)
           VALUES (?, ?, ?, 'FEE_REMINDER', ?, ?)`,
          [fee.institute_id, student.id, fee.batch_id, message, meta]
        );
        existing.add(key);
        created += 1;
      }
    }
  }
  return created;
}

function buildAttendanceCsv(rows) {
  return stringify(
    rows.map((item) => [
      item.id,
      item.batch_id,
      item.student_id,
      item.date,
      item.status,
      item.marked_by,
      item.created_at
    ]),
    {
      header: true,
      columns: ["attendance_id", "batch_id", "student_id", "date", "status", "marked_by", "created_at"]
    }
  );
}

module.exports = {
  ensureStorageDirs,
  resolveStoragePath,
  storeNoteFile,
  createAuditLog,
  parseSchedule,
  getStudentFeeWithPayments,
  calculateDueAmount,
  nextDueInstallment,
  generateReceiptPdf,
  buildWhatsappTemplate,
  runFeeReminders,
  buildAttendanceCsv
};
