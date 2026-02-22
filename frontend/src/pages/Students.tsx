import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Batch, Student } from "../types";
import { useToast } from "../context/ToastContext";

const initialForm = {
  full_name: "",
  phone: "",
  email: "",
  guardian_name: "",
  guardian_phone: "",
  address: "",
  join_date: new Date().toISOString().split("T")[0],
  status: "ACTIVE",
  batch_ids: [] as number[],
};

export function StudentsPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<Student | null>(null);
  const [confirmDisableId, setConfirmDisableId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const [studentData, batchData] = await Promise.all([
        api.listStudents(
          `?page=${page}&page_size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
        ),
        api.listBatches("?page=1&page_size=200"),
      ]);
      setStudents(studentData.items);
      setTotal(studentData.total);
      setBatches(batchData.items);
    } catch {
      pushToast("error", "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, search]);

  const onBatchSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions).map((opt) => Number(opt.value));
    setForm((prev) => ({ ...prev, batch_ids: selected }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditing(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await api.updateStudent(editing.id, {
          full_name: form.full_name,
          phone: form.phone || null,
          email: form.email || null,
          guardian_name: form.guardian_name || null,
          guardian_phone: form.guardian_phone || null,
          address: form.address || null,
          join_date: form.join_date,
          status: form.status,
        });
        await api.assignStudentBatches(editing.id, form.batch_ids);
        pushToast("success", "Student updated");
      } else {
        await api.createStudent({
          ...form,
          phone: form.phone || null,
          email: form.email || null,
          guardian_name: form.guardian_name || null,
          guardian_phone: form.guardian_phone || null,
          address: form.address || null,
        });
        pushToast("success", "Student created");
      }
      resetForm();
      await load();
    } catch {
      pushToast("error", "Could not save student");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (student: Student) => {
    setEditing(student);
    setForm({
      full_name: student.full_name,
      phone: student.phone || "",
      email: student.email || "",
      guardian_name: student.guardian_name || "",
      guardian_phone: student.guardian_phone || "",
      address: student.address || "",
      join_date: student.join_date,
      status: student.status,
      batch_ids: student.batch_ids,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const disableStudent = async () => {
    if (!confirmDisableId) {
      return;
    }
    try {
      await api.disableStudent(confirmDisableId);
      pushToast("success", "Student disabled");
      await load();
    } catch {
      pushToast("error", "Failed to disable student");
    } finally {
      setConfirmDisableId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-display text-xl text-charcoal">{editing ? "Edit Student" : "Add Student"}</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            required
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            placeholder="Guardian name"
            value={form.guardian_name}
            onChange={(e) => setForm((prev) => ({ ...prev, guardian_name: e.target.value }))}
          />
          <input
            placeholder="Guardian phone"
            value={form.guardian_phone}
            onChange={(e) => setForm((prev) => ({ ...prev, guardian_phone: e.target.value }))}
          />
          <input
            placeholder="Join date"
            type="date"
            value={form.join_date}
            onChange={(e) => setForm((prev) => ({ ...prev, join_date: e.target.value }))}
            required
          />
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
          <select multiple value={form.batch_ids.map(String)} onChange={onBatchSelect}>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <textarea
            className="sm:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            rows={2}
          />
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Update Student" : "Create Student"}
            </button>
            {editing ? (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-charcoal">Students</h2>
          <input
            className="w-full sm:w-72"
            placeholder="Search by name"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {!students.length ? (
          <EmptyState title="No students found" subtitle="Try adding students or changing filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-charcoal/70">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Batches</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-sand/70">
                    <td className="py-2 font-semibold">{student.full_name}</td>
                    <td className="py-2">{student.phone || "-"}</td>
                    <td className="py-2">{student.email || "-"}</td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          student.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="py-2">{student.batch_ids.length}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary px-3 py-1" onClick={() => startEdit(student)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                          onClick={() => setConfirmDisableId(student.id)}
                          type="button"
                        >
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <p>
            Page {page} / {totalPages} ({total} students)
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDisableId)}
        title="Disable Student"
        description="This student will be marked as DISABLED. Continue?"
        onCancel={() => setConfirmDisableId(null)}
        onConfirm={disableStudent}
      />
    </div>
  );
}
