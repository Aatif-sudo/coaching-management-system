function parsePagination(query, defaultSize = 20) {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.max(Math.min(Number(query.page_size) || defaultSize, 200), 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function userResponse(user) {
  return {
    id: user.id,
    institute_id: user.institute_id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: Boolean(user.is_active),
    student_id: user.student_id,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

async function serializeStudent(db, student) {
  const links = await db.all("SELECT batch_id FROM student_batches WHERE student_id = ?", [student.id]);
  return { ...student, batch_ids: links.map((item) => item.batch_id) };
}

module.exports = {
  parsePagination,
  userResponse,
  serializeStudent
};
