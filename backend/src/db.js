const path = require("path");
const fs = require("fs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const config = require("./config");

let db;

async function connectDb() {
  if (db) {
    return db;
  }
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  db = await open({
    filename: config.databaseFile,
    driver: sqlite3.Database
  });
  await db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

async function initializeSchema() {
  const database = await connectDb();
  await database.exec(`
    CREATE TABLE IF NOT EXISTS institutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      address TEXT,
      join_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'DISABLED')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'TEACHER', 'STUDENT')),
      is_active INTEGER NOT NULL DEFAULT 1,
      student_id INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS fee_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('MONTHLY', 'QUARTERLY', 'ONE_TIME', 'CUSTOM')),
      amount REAL NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      course TEXT NOT NULL,
      schedule TEXT NOT NULL,
      teacher_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT,
      fee_plan_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id)
    );

    CREATE TABLE IF NOT EXISTS student_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      UNIQUE(student_id, batch_id),
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT')),
      marked_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(batch_id, student_id, date),
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (marked_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS student_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      fee_plan_id INTEGER,
      total_fee REAL NOT NULL,
      discount REAL NOT NULL,
      due_schedule_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, batch_id),
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      student_fee_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid_on TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('CASH', 'UPI', 'BANK')),
      receipt_no TEXT NOT NULL UNIQUE,
      remarks TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      student_id INTEGER,
      batch_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('FEE_REMINDER', 'ANNOUNCEMENT', 'SYSTEM')),
      message TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS reminder_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      batch_id INTEGER,
      name TEXT NOT NULL,
      days_before INTEGER NOT NULL,
      on_due_date INTEGER NOT NULL,
      every_n_days_after_due INTEGER NOT NULL,
      is_active INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institute_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institute_id) REFERENCES institutes(id),
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    );
  `);
}

module.exports = {
  connectDb,
  initializeSchema
};
