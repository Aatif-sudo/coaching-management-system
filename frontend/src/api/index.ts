import type {
  AttendanceRecord,
  AttendanceStats,
  AuthTokens,
  AuthUser,
  Batch,
  BatchStudent,
  DueItem,
  FeePlan,
  NoteItem,
  NotificationItem,
  PaginatedResponse,
  Payment,
  ReminderRule,
  Student,
  StudentFee,
} from "../types";
import { apiFetch } from "./client";

export const api = {
  login: (email: string, password: string) =>
    apiFetch<AuthTokens>("/auth/login", {
      method: "POST",
      auth: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiFetch<AuthUser>("/auth/me"),

  registerUser: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    role: string;
    student_id?: number | null;
  }) =>
    apiFetch<AuthUser>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  listTeachers: () => apiFetch<AuthUser[]>("/users/teachers"),

  listStudents: (params = "") => apiFetch<PaginatedResponse<Student>>(`/students${params}`),
  createStudent: (payload: Record<string, unknown>) =>
    apiFetch<Student>("/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateStudent: (id: number, payload: Record<string, unknown>) =>
    apiFetch<Student>(`/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  disableStudent: (id: number) =>
    apiFetch<Student>(`/students/${id}/disable`, { method: "PATCH" }),
  assignStudentBatches: (id: number, batchIds: number[]) =>
    apiFetch<Student>(`/students/${id}/batches`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_ids: batchIds }),
    }),

  listBatches: (params = "") => apiFetch<PaginatedResponse<Batch>>(`/batches${params}`),
  createBatch: (payload: Record<string, unknown>) =>
    apiFetch<Batch>("/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateBatch: (id: number, payload: Record<string, unknown>) =>
    apiFetch<Batch>(`/batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteBatch: (id: number) => apiFetch<void>(`/batches/${id}`, { method: "DELETE" }),
  listBatchStudents: (batchId: number) => apiFetch<BatchStudent[]>(`/batches/${batchId}/students`),
  getBatchSchedule: (batchId: number) => apiFetch<Record<string, unknown>>(`/batches/${batchId}/schedule`),

  markAttendance: (payload: {
    batch_id: number;
    date: string;
    records: Array<{ student_id: number; status: string }>;
  }) =>
    apiFetch<AttendanceRecord[]>("/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  attendanceHistory: (params = "") =>
    apiFetch<PaginatedResponse<AttendanceRecord>>(`/attendance/history${params}`),
  attendanceStats: (params = "") => apiFetch<AttendanceStats[]>(`/attendance/stats${params}`),
  attendanceExport: (params = "") =>
    apiFetch<string>(`/attendance/export${params}`, { responseType: "text" }),

  uploadNote: (formData: FormData) =>
    apiFetch("/notes", {
      method: "POST",
      body: formData,
    }),
  listNotes: (params = "") => apiFetch<PaginatedResponse<NoteItem>>(`/notes${params}`),
  downloadNote: (id: number) => apiFetch<Blob>(`/notes/${id}/download`, { responseType: "blob" }),

  createFeePlan: (payload: Record<string, unknown>) =>
    apiFetch<FeePlan>("/fees/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listFeePlans: () => apiFetch<FeePlan[]>("/fees/plans"),
  updateFeePlan: (id: number, payload: Record<string, unknown>) =>
    apiFetch<FeePlan>(`/fees/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteFeePlan: (id: number) => apiFetch<void>(`/fees/plans/${id}`, { method: "DELETE" }),
  assignBatchFeePlan: (batchId: number, feePlanId: number) =>
    apiFetch<{ batch_id: number; fee_plan_id: number }>(`/fees/batches/${batchId}/plan?fee_plan_id=${feePlanId}`, {
      method: "PATCH",
    }),
  createStudentFee: (payload: Record<string, unknown>) =>
    apiFetch<StudentFee>("/fees/student-fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listStudentFees: (params = "") => apiFetch<PaginatedResponse<StudentFee>>(`/fees/student-fees${params}`),
  createPayment: (payload: Record<string, unknown>) =>
    apiFetch<Payment>("/fees/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listPayments: (params = "") => apiFetch<PaginatedResponse<Payment>>(`/fees/payments${params}`),
  listDues: (params = "") => apiFetch<DueItem[]>(`/fees/dues${params}`),
  downloadReceipt: (paymentId: number) =>
    apiFetch<Blob>(`/fees/payments/${paymentId}/receipt`, { responseType: "blob" }),

  listNotifications: (params = "") =>
    apiFetch<PaginatedResponse<NotificationItem>>(`/notifications${params}`),
  markNotificationRead: (id: number) =>
    apiFetch<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" }),
  createAnnouncement: (payload: Record<string, unknown>) =>
    apiFetch<NotificationItem>("/notifications/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  runReminders: () => apiFetch<{ created_notifications: number }>("/notifications/run-reminders", { method: "POST" }),
  listReminderRules: () => apiFetch<ReminderRule[]>("/notifications/reminder-rules"),
  createReminderRule: (payload: Record<string, unknown>) =>
    apiFetch<ReminderRule>("/notifications/reminder-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateReminderRule: (id: number, payload: Record<string, unknown>) =>
    apiFetch<ReminderRule>(`/notifications/reminder-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteReminderRule: (id: number) => apiFetch<void>(`/notifications/reminder-rules/${id}`, { method: "DELETE" }),
  getWhatsappTemplate: (id: number) =>
    apiFetch<{ template: string }>(`/notifications/${id}/whatsapp-template`),

  adminDashboard: () => apiFetch<Record<string, unknown>>("/dashboard/admin"),
  studentDashboard: () => apiFetch<Record<string, unknown>>("/dashboard/student"),
};
