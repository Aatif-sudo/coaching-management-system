const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { connectDb } = require("../db");
const { requireAuth, requireRoles } = require("../auth");
const { parsePagination } = require("./helpers");
const { storeNoteFile, resolveStoragePath } = require("../services");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/notes", requireRoles("ADMIN", "TEACHER"), upload.single("file"), async (req, res) => {
  const db = await connectDb();
  const batch = await db.get("SELECT id FROM batches WHERE id = ? AND institute_id = ?", [req.body.batch_id, req.user.institute_id]);
  if (!batch) {
    return res.status(404).json({ detail: "Batch not found" });
  }
  if (!req.file) {
    return res.status(400).json({ detail: "file is required" });
  }
  const fileInfo = storeNoteFile(req.file);
  const created = await db.run(
    `INSERT INTO notes (institute_id, batch_id, title, description, tags, file_name, file_path, file_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.institute_id,
      req.body.batch_id,
      req.body.title,
      req.body.description || null,
      req.body.tags || null,
      fileInfo.originalName,
      fileInfo.relativePath,
      fileInfo.contentType,
      req.user.id
    ]
  );
  const note = await db.get("SELECT * FROM notes WHERE id = ?", [created.lastID]);
  res.status(201).json(note);
});

router.get("/notes", requireAuth, async (req, res) => {
  const db = await connectDb();
  const { page, pageSize, offset } = parsePagination(req.query, 20);
  const params = [req.user.institute_id];
  let where = "WHERE n.institute_id = ?";
  let joinSql = "";
  if (req.query.batch_id) {
    where += " AND n.batch_id = ?";
    params.push(Number(req.query.batch_id));
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    joinSql = "JOIN student_batches sb ON sb.batch_id = n.batch_id";
    where += " AND sb.student_id = ?";
    params.push(req.user.student_id);
  }
  const total = await db.get(
    `SELECT COUNT(*) as total FROM (SELECT DISTINCT n.id FROM notes n ${joinSql} ${where}) x`,
    params
  );
  const rows = await db.all(
    `SELECT DISTINCT n.* FROM notes n ${joinSql} ${where}
     ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ total: total.total, page, page_size: pageSize, items: rows });
});

router.get("/notes/:noteId/download", requireAuth, async (req, res) => {
  const db = await connectDb();
  const noteId = Number(req.params.noteId);
  const note = await db.get("SELECT * FROM notes WHERE id = ? AND institute_id = ?", [noteId, req.user.institute_id]);
  if (!note) {
    return res.status(404).json({ detail: "Note not found" });
  }
  if (req.user.role === "STUDENT") {
    if (!req.user.student_id) {
      return res.status(403).json({ detail: "Student profile missing" });
    }
    const link = await db.get("SELECT id FROM student_batches WHERE student_id = ? AND batch_id = ?", [req.user.student_id, note.batch_id]);
    if (!link) {
      return res.status(403).json({ detail: "Not allowed" });
    }
  }
  let filePath;
  try {
    filePath = resolveStoragePath(note.file_path);
  } catch (_error) {
    return res.status(400).json({ detail: "Invalid file path" });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ detail: "Stored file missing" });
  }
  res.setHeader("Content-Type", note.file_type);
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(note.file_name)}"`);
  res.sendFile(filePath);
});

module.exports = router;
