export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  student_id?: number | null;
  is_active: boolean;
}

export interface Student {
  id: number;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  address?: string | null;
  join_date: string;
  status: "ACTIVE" | "DISABLED";
  batch_ids: number[];
}

export interface Batch {
  id: number;
  name: string;
  course: string;
  schedule: string;
  teacher_id?: number | null;
  start_date: string;
  end_date?: string | null;
  fee_plan_id?: number | null;
}

export interface BatchStudent {
  id: number;
  full_name: string;
  phone?: string | null;
  email?: string | null;
}

export interface AttendanceRecord {
  id: number;
  batch_id: number;
  student_id: number;
  date: string;
  status: "PRESENT" | "ABSENT";
  marked_by: number;
}

export interface AttendanceStats {
  student_id: number;
  batch_id: number;
  total_classes: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
}

export interface NoteItem {
  id: number;
  batch_id: number;
  title: string;
  description?: string | null;
  tags?: string | null;
  file_name: string;
  file_type: string;
  created_by: number;
  created_at: string;
}

export interface FeePlan {
  id: number;
  name: string;
  type: "MONTHLY" | "QUARTERLY" | "ONE_TIME" | "CUSTOM";
  amount: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface StudentFee {
  id: number;
  student_id: number;
  batch_id: number;
  fee_plan_id?: number | null;
  total_fee: string;
  discount: string;
  due_schedule: Array<{ due_date: string; amount: string }>;
  paid_amount: string;
  due_amount: string;
}

export interface Payment {
  id: number;
  student_fee_id: number;
  amount: string;
  paid_on: string;
  mode: "CASH" | "UPI" | "BANK";
  receipt_no: string;
  remarks?: string | null;
}

export interface DueItem {
  student_fee_id: number;
  student_id: number;
  student_name: string;
  batch_id: number;
  batch_name: string;
  total_fee: string;
  discount: string;
  paid_amount: string;
  due_amount: string;
  next_due_date?: string | null;
  upcoming_due_amount?: string | null;
}

export interface NotificationItem {
  id: number;
  student_id?: number | null;
  batch_id?: number | null;
  type: "FEE_REMINDER" | "ANNOUNCEMENT" | "SYSTEM";
  message: string;
  meta_json?: Record<string, unknown> | null;
  created_at: string;
  read_at?: string | null;
}

export interface ReminderRule {
  id: number;
  name: string;
  batch_id?: number | null;
  days_before: number;
  on_due_date: boolean;
  every_n_days_after_due: number;
  is_active: boolean;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

