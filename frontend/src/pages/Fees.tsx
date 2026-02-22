import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Batch, DueItem, FeePlan, Payment, Student, StudentFee } from "../types";
import { useToast } from "../context/ToastContext";

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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-3">
        <form className="card space-y-3" onSubmit={createPlan}>
          <h2 className="font-display text-xl text-charcoal">Fee Plan</h2>
          <input
            placeholder="Plan name"
            value={planForm.name}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <select
            value={planForm.type}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            <option value="MONTHLY">MONTHLY</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="ONE_TIME">ONE_TIME</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
          <input
            placeholder="Amount"
            type="number"
            min={1}
            value={planForm.amount}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
          <textarea
            rows={2}
            value={planForm.metadata_json}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, metadata_json: e.target.value }))}
            placeholder='Optional metadata JSON, e.g. {"months":3}'
          />
          <button className="btn-primary" type="submit">
            Create Plan
          </button>
        </form>

        <form className="card space-y-3" onSubmit={createStudentFee}>
          <h2 className="font-display text-xl text-charcoal">Student Fee Mapping</h2>
          <select
            value={studentFeeForm.student_id}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, student_id: e.target.value }))}
            required
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </select>
          <select
            value={studentFeeForm.batch_id}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, batch_id: e.target.value }))}
            required
          >
            <option value="">Select batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <select
            value={studentFeeForm.fee_plan_id}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, fee_plan_id: e.target.value }))}
          >
            <option value="">No plan</option>
            {feePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Total fee"
            type="number"
            min={1}
            value={studentFeeForm.total_fee}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, total_fee: e.target.value }))}
            required
          />
          <input
            placeholder="Discount"
            type="number"
            min={0}
            value={studentFeeForm.discount}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, discount: e.target.value }))}
          />
          <textarea
            rows={4}
            value={studentFeeForm.due_schedule_text}
            onChange={(e) => setStudentFeeForm((prev) => ({ ...prev, due_schedule_text: e.target.value }))}
            placeholder={"Due schedule lines: YYYY-MM-DD,amount\n2026-03-01,3000"}
            required
          />
          <button className="btn-primary" type="submit">
            Map Fee
          </button>
        </form>

        <form className="card space-y-3" onSubmit={createPayment}>
          <h2 className="font-display text-xl text-charcoal">Record Payment</h2>
          <select
            value={paymentForm.student_fee_id}
            onChange={(e) => setPaymentForm((prev) => ({ ...prev, student_fee_id: e.target.value }))}
            required
          >
            <option value="">Select student fee</option>
            {studentFees.map((item) => (
              <option key={item.id} value={item.id}>
                Fee#{item.id} | Student {item.student_id} | Due {item.due_amount}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder="Amount paid"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
          <input
            type="date"
            value={paymentForm.paid_on}
            onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_on: e.target.value }))}
            required
          />
          <select
            value={paymentForm.mode}
            onChange={(e) => setPaymentForm((prev) => ({ ...prev, mode: e.target.value }))}
          >
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK">BANK</option>
          </select>
          <textarea
            rows={2}
            placeholder="Remarks"
            value={paymentForm.remarks}
            onChange={(e) => setPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))}
          />
          <button className="btn-primary" type="submit">
            Save Payment
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-display text-xl text-charcoal">Unpaid Dues</h2>
        {!dues.length ? (
          <div className="mt-3">
            <EmptyState title="No pending dues" />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-charcoal/70">
                <tr>
                  <th className="py-2">Student</th>
                  <th className="py-2">Batch</th>
                  <th className="py-2">Due</th>
                  <th className="py-2">Next Due</th>
                  <th className="py-2">Upcoming Amount</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((item) => (
                  <tr key={item.student_fee_id} className="border-t border-sand/70">
                    <td className="py-2">{item.student_name}</td>
                    <td className="py-2">{item.batch_name}</td>
                    <td className="py-2">{item.due_amount}</td>
                    <td className="py-2">{item.next_due_date || "-"}</td>
                    <td className="py-2">{item.upcoming_due_amount || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Student Fee Mappings</h2>
          {!studentFees.length ? (
            <div className="mt-3">
              <EmptyState title="No fee mappings yet" />
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              {studentFees.map((item) => (
                <div key={item.id} className="rounded-lg border border-sand p-3">
                  <p className="font-semibold">
                    Fee#{item.id} | Student {item.student_id} | Batch {item.batch_id}
                  </p>
                  <p>
                    Total: {item.total_fee} | Paid: {item.paid_amount} | Due: {item.due_amount}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-xl text-charcoal">Payments & Receipts</h2>
          {!payments.length ? (
            <div className="mt-3">
              <EmptyState title="No payments yet" />
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-sand p-3">
                  <p className="font-semibold">
                    {payment.receipt_no} | Fee#{payment.student_fee_id}
                  </p>
                  <p>
                    Amount {payment.amount} on {payment.paid_on} via {payment.mode}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary mt-2"
                    onClick={() => void downloadReceipt(payment.id, payment.receipt_no)}
                  >
                    Download Receipt
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

