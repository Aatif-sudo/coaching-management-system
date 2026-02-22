import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Batch, ReminderRule } from "../types";
import { useToast } from "../context/ToastContext";

export function AdminDashboardPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [announcement, setAnnouncement] = useState({ message: "", batch_id: "" });
  const [ruleForm, setRuleForm] = useState({
    name: "Default Rule",
    batch_id: "",
    days_before: 3,
    on_due_date: true,
    every_n_days_after_due: 3,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardData, ruleData, batchData] = await Promise.all([
        api.adminDashboard(),
        api.listReminderRules(),
        api.listBatches("?page=1&page_size=200"),
      ]);
      setDashboard(dashboardData);
      setRules(ruleData);
      setBatches(batchData.items);
    } catch {
      setDashboard(null);
      setRules([]);
      setBatches([]);
      pushToast("error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submitAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!announcement.message.trim()) {
      return;
    }
    try {
      await api.createAnnouncement({
        message: announcement.message,
        batch_id: announcement.batch_id ? Number(announcement.batch_id) : null,
      });
      setAnnouncement({ message: "", batch_id: "" });
      pushToast("success", "Announcement published");
      await load();
    } catch {
      pushToast("error", "Announcement failed");
    }
  };

  const submitRule = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createReminderRule({
        ...ruleForm,
        batch_id: ruleForm.batch_id ? Number(ruleForm.batch_id) : null,
      });
      pushToast("success", "Reminder rule created");
      await load();
    } catch {
      pushToast("error", "Could not create reminder rule");
    }
  };

  const runReminders = async () => {
    try {
      const result = await api.runReminders();
      pushToast("success", `Generated ${result.created_notifications} reminders`);
      await load();
    } catch {
      pushToast("error", "Reminder run failed");
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!dashboard) {
    return <EmptyState title="No dashboard data" subtitle="Please refresh in a moment." />;
  }

  const cards = [
    { label: "Total Students", value: dashboard.total_students },
    { label: "Total Batches", value: dashboard.total_batches },
    { label: "Today's Present", value: dashboard.today_present_records },
    { label: "Unpaid Students", value: dashboard.unpaid_students },
    { label: "Total Due", value: `INR ${dashboard.total_due_amount}` },
  ];

  const upcomingDues = (dashboard.upcoming_dues as Array<Record<string, unknown>>) || [];
  const recentNotifications = (dashboard.recent_notifications as Array<Record<string, unknown>>) || [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="card bg-gradient-to-b from-white to-mist">
            <p className="text-xs uppercase tracking-wide text-charcoal/70">{card.label}</p>
            <p className="mt-2 font-display text-2xl text-charcoal">{String(card.value)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-charcoal">Upcoming Dues</h2>
            <button type="button" onClick={runReminders} className="btn-secondary">
              Run Reminder Job
            </button>
          </div>
          {!upcomingDues.length ? (
            <EmptyState title="No dues right now" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-charcoal/70">
                  <tr>
                    <th className="py-2">Student</th>
                    <th className="py-2">Batch</th>
                    <th className="py-2">Due Date</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDues.map((row, idx) => (
                    <tr key={idx} className="border-t border-sand/70">
                      <td className="py-2">{String(row.student_name)}</td>
                      <td className="py-2">{String(row.batch_name)}</td>
                      <td className="py-2">{String(row.next_due_date || "-")}</td>
                      <td className="py-2 text-right">INR {String(row.due_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Recent Notifications</h2>
          {!recentNotifications.length ? (
            <div className="mt-3">
              <EmptyState title="No notifications yet" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentNotifications.map((item) => (
                <li key={String(item.id)} className="rounded-lg border border-sand p-3">
                  <p className="text-xs uppercase text-charcoal/60">{String(item.type)}</p>
                  <p className="text-sm font-semibold text-charcoal">{String(item.message)}</p>
                  <p className="text-xs text-charcoal/60">{String(item.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <form className="card space-y-3" onSubmit={submitAnnouncement}>
          <h3 className="font-display text-xl text-charcoal">Create Announcement</h3>
          <textarea
            value={announcement.message}
            onChange={(e) => setAnnouncement((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Write message for students"
            rows={3}
            required
          />
          <select
            value={announcement.batch_id}
            onChange={(e) => setAnnouncement((prev) => ({ ...prev, batch_id: e.target.value }))}
          >
            <option value="">Global announcement (all students)</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Publish
          </button>
        </form>

        <form className="card space-y-3" onSubmit={submitRule}>
          <h3 className="font-display text-xl text-charcoal">Reminder Rule</h3>
          <input
            value={ruleForm.name}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Rule name"
            required
          />
          <select
            value={ruleForm.batch_id}
            onChange={(e) => setRuleForm((prev) => ({ ...prev, batch_id: e.target.value }))}
          >
            <option value="">Global rule</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={0}
              value={ruleForm.days_before}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, days_before: Number(e.target.value) }))}
              placeholder="Days before due"
            />
            <input
              type="number"
              min={1}
              value={ruleForm.every_n_days_after_due}
              onChange={(e) =>
                setRuleForm((prev) => ({
                  ...prev,
                  every_n_days_after_due: Number(e.target.value),
                }))
              }
              placeholder="Repeat every N days"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={ruleForm.on_due_date}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, on_due_date: e.target.checked }))}
            />
            Trigger on due date
          </label>
          <button className="btn-primary" type="submit">
            Save Rule
          </button>
          <div className="rounded-lg border border-sand p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/70">Active Rules</p>
            <div className="mt-2 space-y-2 text-sm">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-md border border-sand px-3 py-2">
                  <p className="font-semibold">{rule.name}</p>
                  <p className="text-xs text-charcoal/70">
                    before={rule.days_before}, on_due={String(rule.on_due_date)}, repeat={rule.every_n_days_after_due}
                  </p>
                </div>
              ))}
              {!rules.length ? <p className="text-xs text-charcoal/70">No rules configured.</p> : null}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

