import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { NotificationItem } from "../types";
import { useToast } from "../context/ToastContext";

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

  if (loading) {
    return <LoadingSpinner />;
  }
  if (!dashboard) {
    return <EmptyState title="No student data available" />;
  }

  const batches = (dashboard.batches as Array<Record<string, unknown>>) || [];
  const attendance = (dashboard.attendance as Array<Record<string, unknown>>) || [];
  const notes = (dashboard.notes as Array<Record<string, unknown>>) || [];
  const fees = (dashboard.fees as Array<Record<string, unknown>>) || [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card bg-gradient-to-b from-white to-mist">
          <p className="text-xs uppercase tracking-wide text-charcoal/70">Total Due</p>
          <p className="mt-2 font-display text-2xl text-charcoal">INR {String(dashboard.total_due_amount)}</p>
        </div>
        <div className="card bg-gradient-to-b from-white to-mist">
          <p className="text-xs uppercase tracking-wide text-charcoal/70">Batches</p>
          <p className="mt-2 font-display text-2xl text-charcoal">{batches.length}</p>
        </div>
        <div className="card bg-gradient-to-b from-white to-mist">
          <p className="text-xs uppercase tracking-wide text-charcoal/70">Unread Alerts</p>
          <p className="mt-2 font-display text-2xl text-charcoal">{unreadCount}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Batch Details</h2>
          {!batches.length ? (
            <div className="mt-3">
              <EmptyState title="No active batches" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {batches.map((batch) => (
                <li key={String(batch.id)} className="rounded-lg border border-sand p-3">
                  <p className="font-semibold">{String(batch.name)}</p>
                  <p>{String(batch.course)}</p>
                  <p className="text-xs text-charcoal/70">{String(batch.schedule)}</p>
                  <p className="text-xs text-charcoal/70">Teacher: {String(batch.teacher_name || "-")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Attendance %</h2>
          {!attendance.length ? (
            <div className="mt-3">
              <EmptyState title="No attendance data yet" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {attendance.map((item, index) => (
                <li key={index} className="rounded-lg border border-sand p-3">
                  <p>Batch #{String(item.batch_id)}</p>
                  <p>
                    Present {String(item.present)} / {String(item.total_classes)}
                  </p>
                  <p className="font-semibold text-bronze">{String(item.percentage)}%</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Notes</h2>
          {!notes.length ? (
            <div className="mt-3">
              <EmptyState title="No notes shared yet" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {notes.map((note) => (
                <li key={String(note.id)} className="rounded-lg border border-sand p-3">
                  <p className="font-semibold">{String(note.title)}</p>
                  <p className="text-charcoal/70">{String(note.description || "-")}</p>
                  <button
                    type="button"
                    className="btn-secondary mt-2"
                    onClick={() => void downloadNote(Number(note.id), String(note.file_name))}
                  >
                    Download {String(note.file_name)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Fees & Payments</h2>
          {!fees.length ? (
            <div className="mt-3">
              <EmptyState title="No fee records yet" />
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              {fees.map((fee) => {
                const paymentRows = (fee.payments as Array<Record<string, unknown>>) || [];
                return (
                  <div key={String(fee.student_fee_id)} className="rounded-lg border border-sand p-3">
                    <p className="font-semibold">{String(fee.batch_name)}</p>
                    <p>
                      Total: {String(fee.total_fee)} | Paid: {String(fee.paid_amount)} | Due: {String(fee.due_amount)}
                    </p>
                    <div className="mt-2 space-y-1">
                      {paymentRows.map((payment) => (
                        <div key={String(payment.id)} className="rounded-md border border-sand/80 p-2">
                          <p>
                            {String(payment.date)} | {String(payment.amount)} | {String(payment.mode)}
                          </p>
                          <button
                            className="btn-secondary mt-1"
                            type="button"
                            onClick={() =>
                              void downloadReceipt(Number(payment.id), String(payment.receipt_no))
                            }
                          >
                            Receipt {String(payment.receipt_no)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-xl text-charcoal">Notifications</h2>
        {!notifications.length ? (
          <div className="mt-3">
            <EmptyState title="No notifications yet" />
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-lg border p-3 ${
                  notification.read_at ? "border-sand/70 bg-white" : "border-bronze/40 bg-amber-50"
                }`}
              >
                <p className="text-xs uppercase text-charcoal/60">{notification.type}</p>
                <p className="font-semibold">{notification.message}</p>
                <p className="text-xs text-charcoal/60">{notification.created_at}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!notification.read_at ? (
                    <button className="btn-secondary" onClick={() => void markRead(notification.id)} type="button">
                      Mark as Read
                    </button>
                  ) : null}
                  {notification.type === "FEE_REMINDER" ? (
                    <button
                      className="btn-secondary"
                      onClick={() => void copyWhatsAppTemplate(notification.id)}
                      type="button"
                    >
                      Copy WhatsApp Text
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
