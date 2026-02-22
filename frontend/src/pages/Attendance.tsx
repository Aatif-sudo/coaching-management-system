import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { AttendanceRecord, AttendanceStats, Batch, BatchStudent } from "../types";
import { useToast } from "../context/ToastContext";

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
    if (!selectedBatchId) {
      return;
    }
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
    if (!selectedBatchId) {
      return;
    }
    void loadBatchStudents(selectedBatchId);
    void loadHistory();
  }, [selectedBatchId]);

  const submitAttendance = async () => {
    if (!selectedBatchId || !students.length) {
      return;
    }
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
    if (!selectedBatchId) {
      return;
    }
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
    if (!stats.length) {
      return 0;
    }
    const total = stats.reduce((acc, item) => acc + item.total_classes, 0);
    const present = stats.reduce((acc, item) => acc + item.present_count, 0);
    return total ? Math.round((present / total) * 10000) / 100 : 0;
  }, [stats]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-display text-xl text-charcoal">Mark Attendance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={selectedBatchId || ""}
            onChange={(e) => setSelectedBatchId(Number(e.target.value))}
          >
            <option value="">Select batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-primary" onClick={submitAttendance} type="button">
            Save Attendance
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {!students.length ? (
            <EmptyState title="No students in this batch" />
          ) : (
            students.map((student) => (
              <div
                key={student.id}
                className="grid items-center gap-2 rounded-lg border border-sand px-3 py-2 sm:grid-cols-[1fr_120px]"
              >
                <div>
                  <p className="text-sm font-semibold">{student.full_name}</p>
                  <p className="text-xs text-charcoal/70">{student.phone || student.email || "-"}</p>
                </div>
                <select
                  value={statusMap[student.id] || "PRESENT"}
                  onChange={(e) =>
                    setStatusMap((prev) => ({
                      ...prev,
                      [student.id]: e.target.value as "PRESENT" | "ABSENT",
                    }))
                  }
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-charcoal">Attendance History</h2>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
            <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            <button className="btn-secondary" onClick={() => void loadHistory()} type="button">
              Filter
            </button>
            <button className="btn-secondary" onClick={exportCsv} type="button">
              Export CSV
            </button>
          </div>
        </div>

        <p className="text-sm text-charcoal/80">Batch attendance percentage: {overallPercent}%</p>

        {!history.length ? (
          <EmptyState title="No attendance records" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-charcoal/70">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Student ID</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Marked By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-t border-sand/70">
                    <td className="py-2">{item.date}</td>
                    <td className="py-2">{item.student_id}</td>
                    <td className="py-2">{item.status}</td>
                    <td className="py-2">{item.marked_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

