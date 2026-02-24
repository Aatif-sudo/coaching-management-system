import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import type { SelectChangeEvent } from "@mui/material";
import { api } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useToast } from "../context/ToastContext";
import type { Batch, Student } from "../types";

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

  const resetForm = () => {
    setForm(initialForm);
    setEditing(null);
  };

  const onBatchSelect = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    const batchIds = (typeof value === "string" ? value.split(",") : value).map(Number);
    setForm((prev) => ({ ...prev, batch_ids: batchIds }));
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
    if (!confirmDisableId) return;
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

  if (loading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h5">{editing ? "Edit Student" : "Add Student"}</Typography>
        <Box component="form" onSubmit={submit} sx={{ mt: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <Box>
              <TextField
                label="Full Name"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                required
                fullWidth
              />
            </Box>
            <Box>
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Box>
            <Box>
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                fullWidth
              />
            </Box>
            <Box>
              <TextField
                label="Guardian Name"
                value={form.guardian_name}
                onChange={(e) => setForm((prev) => ({ ...prev, guardian_name: e.target.value }))}
                fullWidth
              />
            </Box>
            <Box>
              <TextField
                label="Guardian Phone"
                value={form.guardian_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, guardian_phone: e.target.value }))}
                fullWidth
              />
            </Box>
            <Box>
              <TextField
                label="Join Date"
                type="date"
                value={form.join_date}
                onChange={(e) => setForm((prev) => ({ ...prev, join_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="DISABLED">DISABLED</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel>Batches</InputLabel>
                <Select
                  multiple
                  label="Batches"
                  value={form.batch_ids}
                  onChange={onBatchSelect}
                  renderValue={(selected) => `${selected.length} selected`}
                >
                  {batches.map((batch) => (
                    <MenuItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
              <TextField
                label="Address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                multiline
                rows={2}
                fullWidth
              />
            </Box>
            <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
              <Stack direction="row" spacing={1.5}>
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? "Saving..." : editing ? "Update Student" : "Create Student"}
                </Button>
                {editing ? (
                  <Button type="button" variant="outlined" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="h5">Students</Typography>
          <TextField
            placeholder="Search by name"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            size="small"
            sx={{ minWidth: { xs: "100%", sm: 280 } }}
          />
        </Stack>

        {!students.length ? (
          <EmptyState title="No students found" subtitle="Try adding students or changing filters." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Batches</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{student.full_name}</TableCell>
                    <TableCell>{student.phone || "-"}</TableCell>
                    <TableCell>{student.email || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={student.status}
                        color={student.status === "ACTIVE" ? "success" : "error"}
                        variant={student.status === "ACTIVE" ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>{student.batch_ids.length}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="outlined" onClick={() => startEdit(student)}>
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          onClick={() => setConfirmDisableId(student.id)}
                        >
                          Disable
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
            Page {page} / {totalPages} ({total} students)
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

      <ConfirmDialog
        open={Boolean(confirmDisableId)}
        title="Disable Student"
        description="This student will be marked as DISABLED. Continue?"
        onCancel={() => setConfirmDisableId(null)}
        onConfirm={disableStudent}
      />
    </Stack>
  );
}
