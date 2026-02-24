import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useToast } from "../context/ToastContext";
import type { AuthUser, Batch, BatchStudent, FeePlan } from "../types";

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
    if (!deleteId) return;
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

  if (loading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h5">{editing ? "Edit Batch" : "Create Batch"}</Typography>
        <Box component="form" onSubmit={submit} sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField
            label="Batch Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Course"
            value={form.course}
            onChange={(e) => setForm((prev) => ({ ...prev, course: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Schedule (days/time)"
            value={form.schedule}
            onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value }))}
            required
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Teacher</InputLabel>
            <Select
              label="Teacher"
              value={form.teacher_id}
              onChange={(e) => setForm((prev) => ({ ...prev, teacher_id: e.target.value }))}
            >
              <MenuItem value="">Select teacher</MenuItem>
              {teachers.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Start Date"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
          />
          <TextField
            label="End Date"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Fee Plan</InputLabel>
            <Select
              label="Fee Plan"
              value={form.fee_plan_id}
              onChange={(e) => setForm((prev) => ({ ...prev, fee_plan_id: e.target.value }))}
            >
              <MenuItem value="">No fee plan</MenuItem>
              {feePlans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" type="submit">
                {editing ? "Update Batch" : "Create Batch"}
              </Button>
              {editing ? (
                <Button variant="outlined" type="button" onClick={resetForm}>
                  Cancel Edit
                </Button>
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="h5">Batches</Typography>
          <TextField
            placeholder="Search batches"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            size="small"
            sx={{ minWidth: { xs: "100%", sm: 280 } }}
          />
        </Stack>

        {!batches.length ? (
          <EmptyState title="No batches found" />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Course</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{batch.name}</TableCell>
                    <TableCell>{batch.course}</TableCell>
                    <TableCell>{batch.schedule}</TableCell>
                    <TableCell>
                      {batch.start_date} - {batch.end_date || "ongoing"}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button variant="outlined" size="small" onClick={() => startEdit(batch)}>
                          Edit
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => void loadBatchStudents(batch)}>
                          Students
                        </Button>
                        <Button color="error" variant="contained" size="small" onClick={() => setDeleteId(batch.id)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Page {page} / {totalPages} ({total} batches)
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h5">
          {selectedBatch ? `Students in ${selectedBatch.name}` : "Select a batch to view students"}
        </Typography>
        {!selectedBatch ? null : !batchStudents.length ? (
          <Box sx={{ mt: 1.5 }}>
            <EmptyState title="No students assigned" />
          </Box>
        ) : (
          <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
            {batchStudents.map((student) => (
              <Paper key={student.id} variant="outlined" sx={{ p: 1.25, borderColor: "#e8ddcc" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {student.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {student.phone || student.email || "-"}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Batch"
        description="This action removes the batch record. Continue?"
        onCancel={() => setDeleteId(null)}
        onConfirm={deleteBatch}
      />
    </Stack>
  );
}
