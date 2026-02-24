import { FormEvent, useEffect, useState } from "react";
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
import type { Batch, DueItem, FeePlan, Payment, Student, StudentFee } from "../types";

const planInitial = {
  name: "",
  type: "MONTHLY",
  amount: "",
  metadata_json: "",
};

const studentFeeInitial = {
  student_id: "",
  batch_id: "",
  fee_plan_id: "",
  total_fee: "",
  discount: "0",
  due_schedule_text: "",
};

const paymentInitial = {
  student_fee_id: "",
  amount: "",
  paid_on: new Date().toISOString().split("T")[0],
  mode: "UPI",
  remarks: "",
};

export function FeesPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dues, setDues] = useState<DueItem[]>([]);
  const [planForm, setPlanForm] = useState(planInitial);
  const [studentFeeForm, setStudentFeeForm] = useState(studentFeeInitial);
  const [paymentForm, setPaymentForm] = useState(paymentInitial);

  const load = async () => {
    setLoading(true);
    try {
      const [plans, studentData, batchData, feeData, paymentData, duesData] = await Promise.all([
        api.listFeePlans(),
        api.listStudents("?page=1&page_size=500"),
        api.listBatches("?page=1&page_size=500"),
        api.listStudentFees("?page=1&page_size=200"),
        api.listPayments("?page=1&page_size=200"),
        api.listDues(),
      ]);
      setFeePlans(plans);
      setStudents(studentData.items);
      setBatches(batchData.items);
      setStudentFees(feeData.items);
      setPayments(paymentData.items);
      setDues(duesData);
    } catch {
      pushToast("error", "Could not load fee data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const parseDueSchedule = (text: string) => {
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [due_date, amount] = line.split(",").map((item) => item.trim());
        return { due_date, amount };
      });
    if (!rows.length) {
      throw new Error("Due schedule missing");
    }
    return rows;
  };

  const createPlan = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createFeePlan({
        name: planForm.name,
        type: planForm.type,
        amount: planForm.amount,
        metadata_json: planForm.metadata_json ? JSON.parse(planForm.metadata_json) : null,
      });
      setPlanForm(planInitial);
      pushToast("success", "Fee plan created");
      await load();
    } catch {
      pushToast("error", "Could not create fee plan");
    }
  };

  const createStudentFee = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createStudentFee({
        student_id: Number(studentFeeForm.student_id),
        batch_id: Number(studentFeeForm.batch_id),
        fee_plan_id: studentFeeForm.fee_plan_id ? Number(studentFeeForm.fee_plan_id) : null,
        total_fee: studentFeeForm.total_fee,
        discount: studentFeeForm.discount || "0",
        due_schedule: parseDueSchedule(studentFeeForm.due_schedule_text),
      });
      setStudentFeeForm(studentFeeInitial);
      pushToast("success", "Student fee mapped");
      await load();
    } catch {
      pushToast("error", "Invalid student fee payload");
    }
  };

  const createPayment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createPayment({
        student_fee_id: Number(paymentForm.student_fee_id),
        amount: paymentForm.amount,
        paid_on: paymentForm.paid_on,
        mode: paymentForm.mode,
        remarks: paymentForm.remarks || null,
      });
      setPaymentForm(paymentInitial);
      pushToast("success", "Payment recorded");
      await load();
    } catch {
      pushToast("error", "Could not record payment");
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

  if (loading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Fee Plan</Typography>
          <Stack component="form" onSubmit={createPlan} spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Plan Name"
              value={planForm.name}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={planForm.type}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="MONTHLY">MONTHLY</MenuItem>
                <MenuItem value="QUARTERLY">QUARTERLY</MenuItem>
                <MenuItem value="ONE_TIME">ONE_TIME</MenuItem>
                <MenuItem value="CUSTOM">CUSTOM</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Amount"
              type="number"
              inputProps={{ min: 1 }}
              value={planForm.amount}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
            <TextField
              label="Metadata JSON"
              value={planForm.metadata_json}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, metadata_json: e.target.value }))}
              multiline
              rows={2}
              placeholder='{"months":3}'
            />
            <Button type="submit" variant="contained">
              Create Plan
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Student Fee Mapping</Typography>
          <Stack component="form" onSubmit={createStudentFee} spacing={1.5} sx={{ mt: 1.5 }}>
            <FormControl fullWidth required>
              <InputLabel>Student</InputLabel>
              <Select
                label="Student"
                value={studentFeeForm.student_id}
                onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, student_id: e.target.value }))}
              >
                <MenuItem value="">Select student</MenuItem>
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Batch</InputLabel>
              <Select
                label="Batch"
                value={studentFeeForm.batch_id}
                onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, batch_id: e.target.value }))}
              >
                <MenuItem value="">Select batch</MenuItem>
                {batches.map((batch) => (
                  <MenuItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Fee Plan</InputLabel>
              <Select
                label="Fee Plan"
                value={studentFeeForm.fee_plan_id}
                onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, fee_plan_id: e.target.value }))}
              >
                <MenuItem value="">No plan</MenuItem>
                {feePlans.map((plan) => (
                  <MenuItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Total Fee"
              type="number"
              inputProps={{ min: 1 }}
              value={studentFeeForm.total_fee}
              onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, total_fee: e.target.value }))}
              required
            />
            <TextField
              label="Discount"
              type="number"
              inputProps={{ min: 0 }}
              value={studentFeeForm.discount}
              onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, discount: e.target.value }))}
            />
            <TextField
              label="Due Schedule"
              value={studentFeeForm.due_schedule_text}
              onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, due_schedule_text: e.target.value }))}
              multiline
              rows={4}
              placeholder={"YYYY-MM-DD,amount\n2026-03-01,3000"}
              required
            />
            <Button type="submit" variant="contained">
              Map Fee
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Record Payment</Typography>
          <Stack component="form" onSubmit={createPayment} spacing={1.5} sx={{ mt: 1.5 }}>
            <FormControl fullWidth required>
              <InputLabel>Student Fee</InputLabel>
              <Select
                label="Student Fee"
                value={paymentForm.student_fee_id}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, student_fee_id: e.target.value }))}
              >
                <MenuItem value="">Select student fee</MenuItem>
                {studentFees.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    Fee#{item.id} | Student {item.student_id} | Due {item.due_amount}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Amount Paid"
              type="number"
              inputProps={{ min: 1 }}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
            <TextField
              label="Paid On"
              type="date"
              value={paymentForm.paid_on}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_on: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Mode</InputLabel>
              <Select
                label="Mode"
                value={paymentForm.mode}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, mode: e.target.value }))}
              >
                <MenuItem value="CASH">CASH</MenuItem>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="BANK">BANK</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Remarks"
              value={paymentForm.remarks}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))}
              multiline
              rows={2}
            />
            <Button type="submit" variant="contained">
              Save Payment
            </Button>
          </Stack>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h6">Unpaid Dues</Typography>
        {!dues.length ? (
          <Box sx={{ mt: 1.5 }}>
            <EmptyState title="No pending dues" />
          </Box>
        ) : (
          <TableContainer sx={{ mt: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Next Due</TableCell>
                  <TableCell>Upcoming Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dues.map((item) => (
                  <TableRow key={item.student_fee_id}>
                    <TableCell>{item.student_name}</TableCell>
                    <TableCell>{item.batch_name}</TableCell>
                    <TableCell>{item.due_amount}</TableCell>
                    <TableCell>{item.next_due_date || "-"}</TableCell>
                    <TableCell>{item.upcoming_due_amount || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Student Fee Mappings</Typography>
          {!studentFees.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No fee mappings yet" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {studentFees.map((item) => (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Fee#{item.id} | Student {item.student_id} | Batch {item.batch_id}
                  </Typography>
                  <Typography variant="body2">
                    Total: {item.total_fee} | Paid: {item.paid_amount} | Due: {item.due_amount}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
          <Typography variant="h6">Payments & Receipts</Typography>
          {!payments.length ? (
            <Box sx={{ mt: 1.5 }}>
              <EmptyState title="No payments yet" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {payments.map((payment) => (
                <Paper key={payment.id} variant="outlined" sx={{ p: 1.5, borderColor: "#e8ddcc" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {payment.receipt_no} | Fee#{payment.student_fee_id}
                  </Typography>
                  <Typography variant="body2">
                    Amount {payment.amount} on {payment.paid_on} via {payment.mode}
                  </Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => void downloadReceipt(payment.id, payment.receipt_no)}
                  >
                    Download Receipt
                  </Button>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
