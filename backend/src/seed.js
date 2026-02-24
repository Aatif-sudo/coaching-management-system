const fs = require("fs");
const path = require("path");
const { initializeSchema, connectDb } = require("./db");
const { hashPassword } = require("./auth");
const { ensureStorageDirs } = require("./services");

function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function runSeed() {
  await initializeSchema();
  ensureStorageDirs();
  const db = await connectDb();

  const existing = await db.get("SELECT id FROM users LIMIT 1");
  if (existing) {
    process.stdout.write("Seed skipped: data already exists.\n");
    return;
  }

  const institute = await db.run("INSERT INTO institutes (name) VALUES (?)", ["Demo Coaching Institute"]);
  const instituteId = institute.lastID;

  const admin = await db.run(
    `INSERT INTO users (institute_id, full_name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', 1)`,
    [instituteId, "System Admin", "admin@demo.com", "9990000001", hashPassword("Admin@123")]
  );
  const teacher = await db.run(
    `INSERT INTO users (institute_id, full_name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'TEACHER', 1)`,
    [instituteId, "Anita Sharma", "teacher@demo.com", "9990000002", hashPassword("Teacher@123")]
  );

  const studentIds = [];
  for (let i = 1; i <= 5; i += 1) {
    const student = await db.run(
      `INSERT INTO students (institute_id, full_name, phone, email, guardian_name, guardian_phone, address, join_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        instituteId,
        `Student ${i}`,
        `900000000${i}`,
        `student${i}@demo.com`,
        `Guardian ${i}`,
        `800000000${i}`,
        `City Block ${i}`,
        isoDateOffset(-60 + i)
      ]
    );
    studentIds.push(student.lastID);
    await db.run(
      `INSERT INTO users (institute_id, full_name, email, phone, password_hash, role, student_id, is_active)
       VALUES (?, ?, ?, ?, ?, 'STUDENT', ?, 1)`,
      [
        instituteId,
        `Student ${i}`,
        `student${i}@demo.com`,
        `900000000${i}`,
        hashPassword("Student@123"),
        student.lastID
      ]
    );
  }

  const monthlyPlan = await db.run(
    `INSERT INTO fee_plans (institute_id, name, type, amount, metadata_json)
     VALUES (?, 'Monthly Standard', 'MONTHLY', 3000, ?)`,
    [instituteId, JSON.stringify({ months: 3 })]
  );
  const quarterlyPlan = await db.run(
    `INSERT INTO fee_plans (institute_id, name, type, amount, metadata_json)
     VALUES (?, 'Quarterly Pro', 'QUARTERLY', 8500, ?)`,
    [instituteId, JSON.stringify({ includes_material: true })]
  );

  const batch1 = await db.run(
    `INSERT INTO batches (institute_id, name, course, schedule, teacher_id, start_date, end_date, fee_plan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      instituteId,
      "Class 10 Maths Morning",
      "Class 10 Mathematics",
      "Mon-Wed-Fri 07:00 AM - 08:30 AM",
      teacher.lastID,
      isoDateOffset(-30),
      isoDateOffset(120),
      monthlyPlan.lastID
    ]
  );
  const batch2 = await db.run(
    `INSERT INTO batches (institute_id, name, course, schedule, teacher_id, start_date, end_date, fee_plan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      instituteId,
      "Class 12 Physics Evening",
      "Class 12 Physics",
      "Tue-Thu-Sat 06:00 PM - 07:30 PM",
      teacher.lastID,
      isoDateOffset(-20),
      isoDateOffset(140),
      quarterlyPlan.lastID
    ]
  );

  for (let i = 0; i < 3; i += 1) {
    await db.run("INSERT INTO student_batches (institute_id, student_id, batch_id) VALUES (?, ?, ?)", [
      instituteId,
      studentIds[i],
      batch1.lastID
    ]);
  }
  for (let i = 2; i < 5; i += 1) {
    await db.run("INSERT INTO student_batches (institute_id, student_id, batch_id) VALUES (?, ?, ?)", [
      instituteId,
      studentIds[i],
      batch2.lastID
    ]);
  }

  const notesDir = path.join(path.resolve(__dirname, ".."), "storage", "notes");
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(path.join(notesDir, "algebra-intro.txt"), "Algebra fundamentals and solved examples.");
  fs.writeFileSync(path.join(notesDir, "physics-motion.txt"), "Kinematics notes and worksheet references.");

  await db.run(
    `INSERT INTO notes (institute_id, batch_id, title, description, tags, file_name, file_path, file_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      instituteId,
      batch1.lastID,
      "Algebra Revision Sheet",
      "Chapter-wise revision notes.",
      "algebra,revision",
      "algebra-intro.txt",
      "notes/algebra-intro.txt",
      "text/plain",
      teacher.lastID
    ]
  );
  await db.run(
    `INSERT INTO notes (institute_id, batch_id, title, description, tags, file_name, file_path, file_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      instituteId,
      batch2.lastID,
      "Physics Motion Notes",
      "Intro to motion and vectors.",
      "physics,motion",
      "physics-motion.txt",
      "notes/physics-motion.txt",
      "text/plain",
      teacher.lastID
    ]
  );

  for (let dayDelta = 1; dayDelta <= 7; dayDelta += 1) {
    const attendanceDate = isoDateOffset(-dayDelta);
    for (let i = 0; i < 3; i += 1) {
      await db.run(
        `INSERT INTO attendance (institute_id, batch_id, student_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          instituteId,
          batch1.lastID,
          studentIds[i],
          attendanceDate,
          (studentIds[i] + dayDelta) % 4 !== 0 ? "PRESENT" : "ABSENT",
          teacher.lastID
        ]
      );
    }
    for (let i = 2; i < 5; i += 1) {
      await db.run(
        `INSERT INTO attendance (institute_id, batch_id, student_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          instituteId,
          batch2.lastID,
          studentIds[i],
          attendanceDate,
          (studentIds[i] + dayDelta) % 5 !== 0 ? "PRESENT" : "ABSENT",
          teacher.lastID
        ]
      );
    }
  }

  function dueSchedule(total) {
    const installment = (total / 3).toFixed(2);
    return JSON.stringify([
      { due_date: isoDateOffset(-10), amount: installment },
      { due_date: isoDateOffset(5), amount: installment },
      { due_date: isoDateOffset(35), amount: installment }
    ]);
  }

  const studentFeeIds = [];
  for (let i = 0; i < 3; i += 1) {
    const row = await db.run(
      `INSERT INTO student_fees (institute_id, student_id, batch_id, fee_plan_id, total_fee, discount, due_schedule_json)
       VALUES (?, ?, ?, ?, 9000, 500, ?)`,
      [instituteId, studentIds[i], batch1.lastID, monthlyPlan.lastID, dueSchedule(9000)]
    );
    studentFeeIds.push(row.lastID);
  }
  for (let i = 2; i < 5; i += 1) {
    const row = await db.run(
      `INSERT INTO student_fees (institute_id, student_id, batch_id, fee_plan_id, total_fee, discount, due_schedule_json)
       VALUES (?, ?, ?, ?, 12000, 1000, ?)`,
      [instituteId, studentIds[i], batch2.lastID, quarterlyPlan.lastID, dueSchedule(12000)]
    );
    studentFeeIds.push(row.lastID);
  }

  for (let i = 0; i < 4; i += 1) {
    await db.run(
      `INSERT INTO payments (institute_id, student_fee_id, amount, paid_on, mode, receipt_no, remarks, created_by)
       VALUES (?, ?, 2500, ?, 'UPI', ?, 'Seed payment', ?)`,
      [instituteId, studentFeeIds[i], isoDateOffset(-2), `SEED-RCPT-${String(i + 1).padStart(3, "0")}`, admin.lastID]
    );
  }

  await db.run(
    `INSERT INTO reminder_rules (institute_id, batch_id, name, days_before, on_due_date, every_n_days_after_due, is_active)
     VALUES (?, NULL, 'Default Reminder Rule', 3, 1, 2, 1)`,
    [instituteId]
  );

  process.stdout.write("Seed completed.\n");
  process.stdout.write("Admin login: admin@demo.com / Admin@123\n");
  process.stdout.write("Teacher login: teacher@demo.com / Teacher@123\n");
  process.stdout.write("Student login: student1@demo.com / Student@123\n");
}

runSeed().catch((error) => {
  process.stderr.write(`Seed failed: ${error.message}\n`);
  process.exit(1);
});
