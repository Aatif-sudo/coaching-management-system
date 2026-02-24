import { FormEvent, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
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
import type { Batch, ReminderRule } from "../types";

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
    if (!announcement.message.trim()) return;
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

  if (loading) return <LoadingSpinner />;
  if (!dashboard) return <EmptyState title="No dashboard data" subtitle="Please refresh in a moment." />;

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
    <Stack spacing={3}>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(5, 1fr)" } }}>
        {cards.map((card) => (
          <Paper
            key={card.label}
            variant="outlined"
            sx={{ p: 2, borderColor: "#e8ddcc", background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)" }}
          >
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.6 }} color="text.secondary">
              {card.label}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75 }}>
              {String(card.value)}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="h6">Upcoming Dues</Typography>
            <Button variant="outlined" onClick={runReminders}>
              Run Reminder Job
            </Button>
          </Stack>
          {!upcomingDues.length ? (
            <EmptyState title="No dues right now" />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upcomingDues.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{String(row.student_name)}</TableCell>
                      <TableCell>{String(row.batch_name)}</TableCell>
                      <TableCell>{String(row.next_due_date || "-")}</TableCell>
                      <TableCell align="right">INR {String(row.due_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Recent Notifications</Typography>
          {!recentNotifications.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No notifications yet" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {recentNotifications.map((item) => (
                <Paper key={String(item.id)} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                    {String(item.type)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {String(item.message)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {String(item.created_at)}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Create Announcement</Typography>
          <Stack component="form" onSubmit={submitAnnouncement} spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Message"
              value={announcement.message}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, message: e.target.value }))}
              multiline
              rows={3}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Target Batch</InputLabel>
              <Select
                label="Target Batch"
                value={announcement.batch_id}
                onChange={(e) => setAnnouncement((prev) => ({ ...prev, batch_id: e.target.value }))}
              >
                <MenuItem value="">Global announcement (all students)</MenuItem>
                {batches.map((batch) => (
                  <MenuItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button type="submit" variant="contained">
              Publish
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Reminder Rule</Typography>
          <Stack component="form" onSubmit={submitRule} spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Rule Name"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Batch</InputLabel>
              <Select
                label="Batch"
                value={ruleForm.batch_id}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, batch_id: e.target.value }))}
              >
                <MenuItem value="">Global rule</MenuItem>
                {batches.map((batch) => (
                  <MenuItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr" }}>
              <TextField
                label="Days Before Due"
                type="number"
                inputProps={{ min: 0 }}
                value={ruleForm.days_before}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, days_before: Number(e.target.value) }))}
              />
              <TextField
                label="Repeat Every N Days"
                type="number"
                inputProps={{ min: 1 }}
                value={ruleForm.every_n_days_after_due}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, every_n_days_after_due: Number(e.target.value) }))}
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={ruleForm.on_due_date}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, on_due_date: e.target.checked }))}
                />
              }
              label="Trigger on due date"
            />
            <Button type="submit" variant="contained">
              Save Rule
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderColor: "#e8ddcc" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase" }} color="text.secondary">
              Active Rules
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {rules.map((rule) => (
                <Paper key={rule.id} variant="outlined" sx={{ px: 1.25, py: 1, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {rule.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    before={rule.days_before}, on_due={String(rule.on_due_date)}, repeat={rule.every_n_days_after_due}
                  </Typography>
                </Paper>
              ))}
              {!rules.length ? (
                <Typography variant="caption" color="text.secondary">
                  No rules configured.
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        </Paper>
      </Box>
    </Stack>
  );
}
