import { useEffect, useMemo, useState } from "react";
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
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useToast } from "../context/ToastContext";
import type { AttendanceRecord, AttendanceStats, Batch, BatchStudent } from "../types";

export function AttendancePage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, "PRESENT" | "ABSENT">>({});
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats[]>([]);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  const loadBase = async () => {
    setLoading(true);
    try {
      const batchData = await api.listBatches("?page=1&page_size=200");
      setBatches(batchData.items);
      if (batchData.items.length && !selectedBatchId) {
        setSelectedBatchId(batchData.items[0].id);
      }
    } catch {
      pushToast("error", "Failed to load attendance module");
    } finally {
      setLoading(false);
    }
  };

  const loadBatchStudents = async (batchId: number) => {
    try {
      const rows = await api.listBatchStudents(batchId);
      setStudents(rows);
      const nextStatus: Record<number, "PRESENT" | "ABSENT"> = {};
      rows.forEach((student) => {
        nextStatus[student.id] = "PRESENT";
      });
      setStatusMap(nextStatus);
    } catch {
      pushToast("error", "Could not load students for selected batch");
    }
  };

  const loadHistory = async () => {
    if (!selectedBatchId) return;
    try {
      const [historyData, statsData] = await Promise.all([
        api.attendanceHistory(
          `?batch_id=${selectedBatchId}&page=1&page_size=100${
            historyFrom ? `&date_from=${historyFrom}` : ""
          }${historyTo ? `&date_to=${historyTo}` : ""}`,
        ),
        api.attendanceStats(`?batch_id=${selectedBatchId}`),
      ]);
      setHistory(historyData.items);
      setStats(statsData);
    } catch {
      pushToast("error", "Could not load attendance history");
    }
  };

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    void loadBatchStudents(selectedBatchId);
    void loadHistory();
  }, [selectedBatchId]);

  const submitAttendance = async () => {
    if (!selectedBatchId || !students.length) return;
    try {
      await api.markAttendance({
        batch_id: selectedBatchId,
        date,
        records: students.map((student) => ({
          student_id: student.id,
          status: statusMap[student.id] || "ABSENT",
        })),
      });
      pushToast("success", "Attendance saved");
      await loadHistory();
    } catch {
      pushToast("error", "Attendance save failed");
    }
  };

  const exportCsv = async () => {
    if (!selectedBatchId) return;
    try {
      const text = await api.attendanceExport(
        `?batch_id=${selectedBatchId}${historyFrom ? `&date_from=${historyFrom}` : ""}${
          historyTo ? `&date_to=${historyTo}` : ""
        }`,
      );
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${selectedBatchId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast("error", "Export failed");
    }
  };

  const overallPercent = useMemo(() => {
    if (!stats.length) return 0;
    const total = stats.reduce((acc, item) => acc + item.total_classes, 0);
    const present = stats.reduce((acc, item) => acc + item.present_count, 0);
    return total ? Math.round((present / total) * 10000) / 100 : 0;
  }, [stats]);

  if (loading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h5">Mark Attendance</Typography>
        <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Batch</InputLabel>
            <Select
              label="Batch"
              value={selectedBatchId || ""}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
            >
              <MenuItem value="">Select batch</MenuItem>
              {batches.map((batch) => (
                <MenuItem key={batch.id} value={batch.id}>
                  {batch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Button variant="contained" onClick={submitAttendance} type="button">
            Save Attendance
          </Button>
        </Box>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {!students.length ? (
            <EmptyState title="No students in this batch" />
          ) : (
            students.map((student) => (
              <Paper
                key={student.id}
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderColor: "#e8ddcc",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 140px" },
                  gap: 1,
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {student.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {student.phone || student.email || "-"}
                  </Typography>
                </Box>
                <FormControl size="small" fullWidth>
                  <Select
                    value={statusMap[student.id] || "PRESENT"}
                    onChange={(e) =>
                      setStatusMap((prev) => ({
                        ...prev,
                        [student.id]: e.target.value as "PRESENT" | "ABSENT",
                      }))
                    }
                  >
                    <MenuItem value="PRESENT">PRESENT</MenuItem>
                    <MenuItem value="ABSENT">ABSENT</MenuItem>
                  </Select>
                </FormControl>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h5">Attendance History</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              type="date"
              label="From"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={() => void loadHistory()} type="button">
              Filter
            </Button>
            <Button variant="outlined" onClick={exportCsv} type="button">
              Export CSV
            </Button>
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Batch attendance percentage: {overallPercent}%
        </Typography>

        {!history.length ? (
          <Box sx={{ mt: 1.5 }}>
            <EmptyState title="No attendance records" />
          </Box>
        ) : (
          <TableContainer sx={{ mt: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Marked By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.student_id}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.marked_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
}
