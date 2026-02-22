"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-02-22 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = sa.Enum("ADMIN", "TEACHER", "STUDENT", name="userrole", native_enum=False)
    student_status = sa.Enum("ACTIVE", "DISABLED", name="studentstatus", native_enum=False)
    attendance_status = sa.Enum("PRESENT", "ABSENT", name="attendancestatus", native_enum=False)
    fee_plan_type = sa.Enum("MONTHLY", "QUARTERLY", "ONE_TIME", "CUSTOM", name="feeplantype", native_enum=False)
    payment_mode = sa.Enum("CASH", "UPI", "BANK", name="paymentmode", native_enum=False)
    notification_type = sa.Enum(
        "FEE_REMINDER",
        "ANNOUNCEMENT",
        "SYSTEM",
        name="notificationtype",
        native_enum=False,
    )

    op.create_table(
        "institutes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_institutes_id", "institutes", ["id"], unique=False)

    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("guardian_name", sa.String(length=150), nullable=True),
        sa.Column("guardian_phone", sa.String(length=20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("join_date", sa.Date(), nullable=False),
        sa.Column("status", student_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_students_id", "students", ["id"], unique=False)
    op.create_index("ix_students_institute_id", "students", ["institute_id"], unique=False)
    op.create_index("ix_students_full_name", "students", ["full_name"], unique=False)
    op.create_index("ix_students_phone", "students", ["phone"], unique=False)
    op.create_index("ix_students_email", "students", ["email"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("student_id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_institute_id", "users", ["institute_id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.create_index("ix_users_phone", "users", ["phone"], unique=False)

    op.create_table(
        "fee_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("type", fee_plan_type, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fee_plans_id", "fee_plans", ["id"], unique=False)
    op.create_index("ix_fee_plans_institute_id", "fee_plans", ["institute_id"], unique=False)
    op.create_index("ix_fee_plans_name", "fee_plans", ["name"], unique=False)

    op.create_table(
        "batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("course", sa.String(length=200), nullable=False),
        sa.Column("schedule", sa.String(length=255), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("fee_plan_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["fee_plan_id"], ["fee_plans.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_batches_id", "batches", ["id"], unique=False)
    op.create_index("ix_batches_institute_id", "batches", ["institute_id"], unique=False)
    op.create_index("ix_batches_name", "batches", ["name"], unique=False)

    op.create_table(
        "student_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "batch_id", name="uq_student_batch"),
    )
    op.create_index("ix_student_batches_id", "student_batches", ["id"], unique=False)
    op.create_index("ix_student_batches_institute_id", "student_batches", ["institute_id"], unique=False)

    op.create_table(
        "attendance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", attendance_status, nullable=False),
        sa.Column("marked_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["marked_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_id", "student_id", "date", name="uq_attendance_record"),
    )
    op.create_index("ix_attendance_id", "attendance", ["id"], unique=False)
    op.create_index("ix_attendance_institute_id", "attendance", ["institute_id"], unique=False)
    op.create_index("ix_attendance_batch_id", "attendance", ["batch_id"], unique=False)
    op.create_index("ix_attendance_student_id", "attendance", ["student_id"], unique=False)
    op.create_index("ix_attendance_date", "attendance", ["date"], unique=False)

    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(length=255), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_type", sa.String(length=100), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_path"),
    )
    op.create_index("ix_notes_id", "notes", ["id"], unique=False)
    op.create_index("ix_notes_institute_id", "notes", ["institute_id"], unique=False)
    op.create_index("ix_notes_batch_id", "notes", ["batch_id"], unique=False)
    op.create_index("ix_notes_title", "notes", ["title"], unique=False)

    op.create_table(
        "student_fees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("fee_plan_id", sa.Integer(), nullable=True),
        sa.Column("total_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("discount", sa.Numeric(10, 2), nullable=False),
        sa.Column("due_schedule_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["fee_plan_id"], ["fee_plans.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "batch_id", name="uq_student_fee_student_batch"),
    )
    op.create_index("ix_student_fees_id", "student_fees", ["id"], unique=False)
    op.create_index("ix_student_fees_institute_id", "student_fees", ["institute_id"], unique=False)
    op.create_index("ix_student_fees_student_id", "student_fees", ["student_id"], unique=False)
    op.create_index("ix_student_fees_batch_id", "student_fees", ["batch_id"], unique=False)

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("student_fee_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("paid_on", sa.String(length=30), nullable=False),
        sa.Column("mode", payment_mode, nullable=False),
        sa.Column("receipt_no", sa.String(length=100), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["student_fee_id"], ["student_fees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("receipt_no"),
    )
    op.create_index("ix_payments_id", "payments", ["id"], unique=False)
    op.create_index("ix_payments_institute_id", "payments", ["institute_id"], unique=False)
    op.create_index("ix_payments_student_fee_id", "payments", ["student_fee_id"], unique=False)
    op.create_index("ix_payments_receipt_no", "payments", ["receipt_no"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("batch_id", sa.Integer(), nullable=True),
        sa.Column("type", notification_type, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("meta_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"], unique=False)
    op.create_index("ix_notifications_institute_id", "notifications", ["institute_id"], unique=False)
    op.create_index("ix_notifications_student_id", "notifications", ["student_id"], unique=False)
    op.create_index("ix_notifications_batch_id", "notifications", ["batch_id"], unique=False)

    op.create_table(
        "reminder_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("days_before", sa.Integer(), nullable=False),
        sa.Column("on_due_date", sa.Boolean(), nullable=False),
        sa.Column("every_n_days_after_due", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reminder_rules_id", "reminder_rules", ["id"], unique=False)
    op.create_index("ix_reminder_rules_institute_id", "reminder_rules", ["institute_id"], unique=False)
    op.create_index("ix_reminder_rules_batch_id", "reminder_rules", ["batch_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("institute_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity", sa.String(length=120), nullable=False),
        sa.Column("entity_id", sa.String(length=120), nullable=False),
        sa.Column("before_json", sa.Text(), nullable=True),
        sa.Column("after_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["institute_id"], ["institutes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_logs_institute_id", "audit_logs", ["institute_id"], unique=False)
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity"], unique=False)
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_entity_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_institute_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_reminder_rules_batch_id", table_name="reminder_rules")
    op.drop_index("ix_reminder_rules_institute_id", table_name="reminder_rules")
    op.drop_index("ix_reminder_rules_id", table_name="reminder_rules")
    op.drop_table("reminder_rules")

    op.drop_index("ix_notifications_batch_id", table_name="notifications")
    op.drop_index("ix_notifications_student_id", table_name="notifications")
    op.drop_index("ix_notifications_institute_id", table_name="notifications")
    op.drop_index("ix_notifications_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_payments_receipt_no", table_name="payments")
    op.drop_index("ix_payments_student_fee_id", table_name="payments")
    op.drop_index("ix_payments_institute_id", table_name="payments")
    op.drop_index("ix_payments_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_student_fees_batch_id", table_name="student_fees")
    op.drop_index("ix_student_fees_student_id", table_name="student_fees")
    op.drop_index("ix_student_fees_institute_id", table_name="student_fees")
    op.drop_index("ix_student_fees_id", table_name="student_fees")
    op.drop_table("student_fees")

    op.drop_index("ix_notes_title", table_name="notes")
    op.drop_index("ix_notes_batch_id", table_name="notes")
    op.drop_index("ix_notes_institute_id", table_name="notes")
    op.drop_index("ix_notes_id", table_name="notes")
    op.drop_table("notes")

    op.drop_index("ix_attendance_date", table_name="attendance")
    op.drop_index("ix_attendance_student_id", table_name="attendance")
    op.drop_index("ix_attendance_batch_id", table_name="attendance")
    op.drop_index("ix_attendance_institute_id", table_name="attendance")
    op.drop_index("ix_attendance_id", table_name="attendance")
    op.drop_table("attendance")

    op.drop_index("ix_student_batches_institute_id", table_name="student_batches")
    op.drop_index("ix_student_batches_id", table_name="student_batches")
    op.drop_table("student_batches")

    op.drop_index("ix_batches_name", table_name="batches")
    op.drop_index("ix_batches_institute_id", table_name="batches")
    op.drop_index("ix_batches_id", table_name="batches")
    op.drop_table("batches")

    op.drop_index("ix_fee_plans_name", table_name="fee_plans")
    op.drop_index("ix_fee_plans_institute_id", table_name="fee_plans")
    op.drop_index("ix_fee_plans_id", table_name="fee_plans")
    op.drop_table("fee_plans")

    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_institute_id", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_students_email", table_name="students")
    op.drop_index("ix_students_phone", table_name="students")
    op.drop_index("ix_students_full_name", table_name="students")
    op.drop_index("ix_students_institute_id", table_name="students")
    op.drop_index("ix_students_id", table_name="students")
    op.drop_table("students")

    op.drop_index("ix_institutes_id", table_name="institutes")
    op.drop_table("institutes")

