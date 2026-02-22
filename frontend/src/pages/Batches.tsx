import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { AuthUser, Batch, BatchStudent, FeePlan } from "../types";
import { useToast } from "../context/ToastContext";

const initialForm = {
  name: "",
  course: "",
  schedule: "",
  teacher_id: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  fee_plan_id: "",
};

export function BatchesPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<AuthUser[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const [batchData, teacherData, feePlanData] = await Promise.all([
        api.listBatches(
          `?page=${page}&page_size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
        ),
        api.listTeachers(),
        api.listFeePlans(),
      ]);
      setBatches(batchData.items);
      setTotal(batchData.total);
      setTeachers(teacherData);
      setFeePlans(feePlanData);
    } catch {
      pushToast("error", "Could not load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, search]);

  const loadBatchStudents = async (batch: Batch) => {
    try {
      const students = await api.listBatchStudents(batch.id);
      setSelectedBatch(batch);
      setBatchStudents(students);
    } catch {
      pushToast("error", "Could not fetch batch students");
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditing(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        fee_plan_id: form.fee_plan_id ? Number(form.fee_plan_id) : null,
        end_date: form.end_date || null,
      };
      if (editing) {
        await api.updateBatch(editing.id, payload);
        pushToast("success", "Batch updated");
      } else {
        await api.createBatch(payload);
        pushToast("success", "Batch created");
      }
      resetForm();
      await load();
    } catch {
      pushToast("error", "Could not save batch");
    }
  };

  const startEdit = (batch: Batch) => {
    setEditing(batch);
    setForm({
      name: batch.name,
      course: batch.course,
      schedule: batch.schedule,
      teacher_id: batch.teacher_id ? String(batch.teacher_id) : "",
      start_date: batch.start_date,
      end_date: batch.end_date || "",
      fee_plan_id: batch.fee_plan_id ? String(batch.fee_plan_id) : "",
    });
  };

  const deleteBatch = async () => {
    if (!deleteId) {
      return;
    }
    try {
      await api.deleteBatch(deleteId);
      pushToast("success", "Batch deleted");
      await load();
    } catch {
      pushToast("error", "Failed to delete batch");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-display text-xl text-charcoal">{editing ? "Edit Batch" : "Create Batch"}</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <input
            placeholder="Batch name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            placeholder="Course"
            value={form.course}
            onChange={(e) => setForm((prev) => ({ ...prev, course: e.target.value }))}
            required
          />
          <input
            placeholder="Schedule (days/time)"
            value={form.schedule}
            onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value }))}
            required
          />
          <select
            value={form.teacher_id}
            onChange={(e) => setForm((prev) => ({ ...prev, teacher_id: e.target.value }))}
          >
            <option value="">Select teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            required
          />
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
          />
          <select
            value={form.fee_plan_id}
            onChange={(e) => setForm((prev) => ({ ...prev, fee_plan_id: e.target.value }))}
          >
            <option value="">No fee plan</option>
            {feePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>

          <div className="sm:col-span-2 flex gap-3">
            <button className="btn-primary" type="submit">
              {editing ? "Update Batch" : "Create Batch"}
            </button>
            {editing ? (
              <button className="btn-secondary" type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-charcoal">Batches</h2>
          <input
            className="w-full sm:w-72"
            placeholder="Search batches"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {!batches.length ? (
          <EmptyState title="No batches found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-charcoal/70">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Course</th>
                  <th className="py-2">Schedule</th>
                  <th className="py-2">Dates</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-sand/70">
                    <td className="py-2 font-semibold">{batch.name}</td>
                    <td className="py-2">{batch.course}</td>
                    <td className="py-2">{batch.schedule}</td>
                    <td className="py-2">
                      {batch.start_date} - {batch.end_date || "ongoing"}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary px-3 py-1" onClick={() => startEdit(batch)} type="button">
                          Edit
                        </button>
                        <button
                          className="btn-secondary px-3 py-1"
                          onClick={() => void loadBatchStudents(batch)}
                          type="button"
                        >
                          Students
                        </button>
                        <button
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                          onClick={() => setDeleteId(batch.id)}
                          type="button"
                        >
                          Delete
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
            Page {page} / {totalPages} ({total} batches)
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

      <section className="card">
        <h2 className="font-display text-xl text-charcoal">
          {selectedBatch ? `Students in ${selectedBatch.name}` : "Select a batch to view students"}
        </h2>
        {!selectedBatch ? null : !batchStudents.length ? (
          <div className="mt-3">
            <EmptyState title="No students assigned" />
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {batchStudents.map((student) => (
              <li key={student.id} className="rounded-lg border border-sand px-3 py-2 text-sm">
                <p className="font-semibold">{student.full_name}</p>
                <p className="text-xs text-charcoal/70">{student.phone || student.email || "-"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Batch"
        description="This action removes the batch record. Continue?"
        onCancel={() => setDeleteId(null)}
        onConfirm={deleteBatch}
      />
    </div>
  );
}

