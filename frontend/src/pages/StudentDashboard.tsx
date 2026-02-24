import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useToast } from "../context/ToastContext";
import type { NotificationItem } from "../types";

export function StudentDashboardPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardData, notificationData] = await Promise.all([
        api.studentDashboard(),
        api.listNotifications(),
      ]);
      setDashboard(dashboardData);
      setNotifications(notificationData.items);
    } catch {
      pushToast("error", "Failed to load student dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch {
      pushToast("error", "Could not update notification");
    }
  };

  const copyWhatsAppTemplate = async (notificationId: number) => {
    try {
      const response = await api.getWhatsappTemplate(notificationId);
      await navigator.clipboard.writeText(response.template);
      pushToast("success", "WhatsApp reminder text copied");
    } catch {
      pushToast("error", "Template copy failed");
    }
  };

  const downloadNote = async (noteId: number, filename: string) => {
    try {
      const blob = await api.downloadNote(noteId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast("error", "Note download failed");
    }
  };

  const downloadReceipt = async (paymentId: number, receiptNo: string) => {
    try {
      const blob = await api.downloadReceipt(paymentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${receiptNo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast("error", "Receipt download failed");
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  if (loading) return <LoadingSpinner />;
  if (!dashboard) return <EmptyState title="No student data available" />;

  const batches = (dashboard.batches as Array<Record<string, unknown>>) || [];
  const attendance = (dashboard.attendance as Array<Record<string, unknown>>) || [];
  const notes = (dashboard.notes as Array<Record<string, unknown>>) || [];
  const fees = (dashboard.fees as Array<Record<string, unknown>>) || [];

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2, borderColor: "#e8ddcc", background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
            Total Due
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.75 }}>
            INR {String(dashboard.total_due_amount)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, borderColor: "#e8ddcc", background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
            Batches
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.75 }}>
            {batches.length}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, borderColor: "#e8ddcc", background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)" }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
            Unread Alerts
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.75 }}>
            {unreadCount}
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Batch Details</Typography>
          {!batches.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No active batches" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {batches.map((batch) => (
                <Paper key={String(batch.id)} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {String(batch.name)}
                  </Typography>
                  <Typography variant="body2">{String(batch.course)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {String(batch.schedule)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Teacher: {String(batch.teacher_name || "-")}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Attendance %</Typography>
          {!attendance.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No attendance data yet" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {attendance.map((item, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2">Batch #{String(item.batch_id)}</Typography>
                  <Typography variant="body2">
                    Present {String(item.present)} / {String(item.total_classes)}
                  </Typography>
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                    {String(item.percentage)}%
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Notes</Typography>
          {!notes.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No notes shared yet" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {notes.map((note) => (
                <Paper key={String(note.id)} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {String(note.title)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {String(note.description || "-")}
                  </Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => void downloadNote(Number(note.id), String(note.file_name))}
                  >
                    Download {String(note.file_name)}
                  </Button>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Fees & Payments</Typography>
          {!fees.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No fee records yet" />
            </Box>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {fees.map((fee) => {
                const paymentRows = (fee.payments as Array<Record<string, unknown>>) || [];
                return (
                  <Paper key={String(fee.student_fee_id)} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {String(fee.batch_name)}
                    </Typography>
                    <Typography variant="body2">
                      Total: {String(fee.total_fee)} | Paid: {String(fee.paid_amount)} | Due: {String(fee.due_amount)}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {paymentRows.map((payment) => (
                        <Paper key={String(payment.id)} variant="outlined" sx={{ p: 1, borderColor: "#e8ddcc" }}>
                          <Typography variant="body2">
                            {String(payment.date)} | {String(payment.amount)} | {String(payment.mode)}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ mt: 0.5 }}
                            type="button"
                            onClick={() => void downloadReceipt(Number(payment.id), String(payment.receipt_no))}
                          >
                            Receipt {String(payment.receipt_no)}
                          </Button>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h6">Notifications</Typography>
        {!notifications.length ? (
          <Box sx={{ mt: 1.5 }}>
            <EmptyState title="No notifications yet" />
          </Box>
        ) : (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {notifications.map((notification) => (
              <Paper
                key={notification.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderColor: notification.read_at ? "#e8ddcc" : "rgba(157, 107, 59, 0.4)",
                  bgcolor: notification.read_at ? "white" : "#fff8e1",
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                  {notification.type}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {notification.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.created_at}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                  {!notification.read_at ? (
                    <Button variant="outlined" size="small" onClick={() => void markRead(notification.id)} type="button">
                      Mark as Read
                    </Button>
                  ) : null}
                  {notification.type === "FEE_REMINDER" ? (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => void copyWhatsAppTemplate(notification.id)}
                      type="button"
                    >
                      Copy WhatsApp Text
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
