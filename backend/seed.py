import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.core.storage import ensure_storage_dirs
from app.models.attendance import Attendance
from app.models.batch import Batch, StudentBatch
from app.models.enums import AttendanceStatus, FeePlanType, PaymentMode, StudentStatus, UserRole
from app.models.fee import FeePlan, Payment, ReminderRule, StudentFee
from app.models.institute import Institute
from app.models.note import Note
from app.models.student import Student
from app.models.user import User


def _create_sample_note_file(storage_dir: str, filename: str, content: str) -> str:
    notes_dir = Path(storage_dir) / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    file_path = notes_dir / filename
    file_path.write_text(content, encoding="utf-8")
    return str(Path("notes") / filename)


def run_seed() -> None:
    db = SessionLocal()
    ensure_storage_dirs()
    try:
        existing_user = db.scalar(select(User.id).limit(1))
        if existing_user:
            print("Seed skipped: data already exists.")
            return

        institute = Institute(name="Demo Coaching Institute")
        db.add(institute)
        db.flush()

        admin = User(
            institute_id=institute.id,
            full_name="System Admin",
            email="admin@demo.com",
            phone="9990000001",
            password_hash=get_password_hash("Admin@123"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        teacher = User(
            institute_id=institute.id,
            full_name="Anita Sharma",
            email="teacher@demo.com",
            phone="9990000002",
            password_hash=get_password_hash("Teacher@123"),
            role=UserRole.TEACHER,
            is_active=True,
        )
        db.add_all([admin, teacher])
        db.flush()

        students: list[Student] = []
        for index in range(1, 6):
            student = Student(
                institute_id=institute.id,
                full_name=f"Student {index}",
                phone=f"900000000{index}",
                email=f"student{index}@demo.com",
                guardian_name=f"Guardian {index}",
                guardian_phone=f"800000000{index}",
                address=f"City Block {index}",
                join_date=date.today() - timedelta(days=60 - index),
                status=StudentStatus.ACTIVE,
            )
            db.add(student)
            db.flush()
            students.append(student)
            db.add(
                User(
                    institute_id=institute.id,
                    full_name=student.full_name,
                    email=student.email,
                    phone=student.phone,
                    password_hash=get_password_hash("Student@123"),
                    role=UserRole.STUDENT,
                    is_active=True,
                    student_id=student.id,
                )
            )

        monthly_plan = FeePlan(
            institute_id=institute.id,
            name="Monthly Standard",
            type=FeePlanType.MONTHLY,
            amount=Decimal("3000.00"),
            metadata_json=json.dumps({"months": 3}),
        )
        quarterly_plan = FeePlan(
            institute_id=institute.id,
            name="Quarterly Pro",
            type=FeePlanType.QUARTERLY,
            amount=Decimal("8500.00"),
            metadata_json=json.dumps({"includes_material": True}),
        )
        db.add_all([monthly_plan, quarterly_plan])
        db.flush()

        batch_1 = Batch(
            institute_id=institute.id,
            name="Class 10 Maths Morning",
            course="Class 10 Mathematics",
            schedule="Mon-Wed-Fri 07:00 AM - 08:30 AM",
            teacher_id=teacher.id,
            start_date=date.today() - timedelta(days=30),
            end_date=date.today() + timedelta(days=120),
            fee_plan_id=monthly_plan.id,
        )
        batch_2 = Batch(
            institute_id=institute.id,
            name="Class 12 Physics Evening",
            course="Class 12 Physics",
            schedule="Tue-Thu-Sat 06:00 PM - 07:30 PM",
            teacher_id=teacher.id,
            start_date=date.today() - timedelta(days=20),
            end_date=date.today() + timedelta(days=140),
            fee_plan_id=quarterly_plan.id,
        )
        db.add_all([batch_1, batch_2])
        db.flush()

        for student in students[:3]:
            db.add(StudentBatch(institute_id=institute.id, student_id=student.id, batch_id=batch_1.id))
        for student in students[2:]:
            db.add(StudentBatch(institute_id=institute.id, student_id=student.id, batch_id=batch_2.id))

        note_path_1 = _create_sample_note_file(
            storage_dir=str(Path(__file__).resolve().parent / "storage"),
            filename="algebra-intro.txt",
            content="Algebra fundamentals and sample solved examples.",
        )
        note_path_2 = _create_sample_note_file(
            storage_dir=str(Path(__file__).resolve().parent / "storage"),
            filename="physics-motion.txt",
            content="Kinematics notes and practice worksheet references.",
        )
        db.add_all(
            [
                Note(
                    institute_id=institute.id,
                    batch_id=batch_1.id,
                    title="Algebra Revision Sheet",
                    description="Chapter-wise revision notes.",
                    tags="algebra,revision",
                    file_name="algebra-intro.txt",
                    file_path=note_path_1,
                    file_type="text/plain",
                    created_by=teacher.id,
                ),
                Note(
                    institute_id=institute.id,
                    batch_id=batch_2.id,
                    title="Physics Motion Notes",
                    description="Intro to motion and vectors.",
                    tags="physics,motion",
                    file_name="physics-motion.txt",
                    file_path=note_path_2,
                    file_type="text/plain",
                    created_by=teacher.id,
                ),
            ]
        )

        for day_delta in range(7):
            attendance_date = date.today() - timedelta(days=day_delta + 1)
            for student in students[:3]:
                db.add(
                    Attendance(
                        institute_id=institute.id,
                        batch_id=batch_1.id,
                        student_id=student.id,
                        date=attendance_date,
                        status=AttendanceStatus.PRESENT if (student.id + day_delta) % 4 != 0 else AttendanceStatus.ABSENT,
                        marked_by=teacher.id,
                    )
                )
            for student in students[2:]:
                db.add(
                    Attendance(
                        institute_id=institute.id,
                        batch_id=batch_2.id,
                        student_id=student.id,
                        date=attendance_date,
                        status=AttendanceStatus.PRESENT if (student.id + day_delta) % 5 != 0 else AttendanceStatus.ABSENT,
                        marked_by=teacher.id,
                    )
                )

        def schedule_for(base_amount: Decimal) -> str:
            schedule = [
                {"due_date": (date.today() - timedelta(days=10)).isoformat(), "amount": str(base_amount / 3)},
                {"due_date": (date.today() + timedelta(days=5)).isoformat(), "amount": str(base_amount / 3)},
                {"due_date": (date.today() + timedelta(days=35)).isoformat(), "amount": str(base_amount / 3)},
            ]
            return json.dumps(schedule)

        student_fee_rows: list[StudentFee] = []
        for student in students[:3]:
            row = StudentFee(
                institute_id=institute.id,
                student_id=student.id,
                batch_id=batch_1.id,
                fee_plan_id=monthly_plan.id,
                total_fee=Decimal("9000.00"),
                discount=Decimal("500.00"),
                due_schedule_json=schedule_for(Decimal("9000.00")),
            )
            db.add(row)
            student_fee_rows.append(row)

        for student in students[2:]:
            row = StudentFee(
                institute_id=institute.id,
                student_id=student.id,
                batch_id=batch_2.id,
                fee_plan_id=quarterly_plan.id,
                total_fee=Decimal("12000.00"),
                discount=Decimal("1000.00"),
                due_schedule_json=schedule_for(Decimal("12000.00")),
            )
            db.add(row)
            student_fee_rows.append(row)

        db.flush()

        for index, student_fee in enumerate(student_fee_rows[:4], start=1):
            db.add(
                Payment(
                    institute_id=institute.id,
                    student_fee_id=student_fee.id,
                    amount=Decimal("2500.00"),
                    paid_on=(date.today() - timedelta(days=2)).isoformat(),
                    mode=PaymentMode.UPI,
                    receipt_no=f"SEED-RCPT-{index:03d}",
                    remarks="Seed payment",
                    created_by=admin.id,
                )
            )

        db.add(
            ReminderRule(
                institute_id=institute.id,
                batch_id=None,
                name="Default Reminder Rule",
                days_before=3,
                on_due_date=True,
                every_n_days_after_due=2,
                is_active=True,
            )
        )

        db.commit()
        print("Seed completed.")
        print("Admin login: admin@demo.com / Admin@123")
        print("Teacher login: teacher@demo.com / Teacher@123")
        print("Student login: student1@demo.com / Student@123")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()

