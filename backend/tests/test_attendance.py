from datetime import date

from app.core.security import get_password_hash
from app.models.batch import Batch, StudentBatch
from app.models.enums import StudentStatus, UserRole
from app.models.institute import Institute
from app.models.student import Student
from app.models.user import User


def _seed_attendance_context(db_session):
    institute = Institute(name="Attendance Institute")
    db_session.add(institute)
    db_session.flush()

    teacher = User(
        institute_id=institute.id,
        full_name="Teacher",
        email="teacher@test.com",
        phone="9111111111",
        password_hash=get_password_hash("Teacher@123"),
        role=UserRole.TEACHER,
        is_active=True,
    )
    student = Student(
        institute_id=institute.id,
        full_name="Student One",
        phone="9222222222",
        email="student@test.com",
        guardian_name="Guardian",
        guardian_phone="9333333333",
        address="Address",
        join_date=date.today(),
        status=StudentStatus.ACTIVE,
    )
    db_session.add_all([teacher, student])
    db_session.flush()

    batch = Batch(
        institute_id=institute.id,
        name="Batch A",
        course="Maths",
        schedule="Mon Wed Fri 7AM",
        teacher_id=teacher.id,
        start_date=date.today(),
        end_date=None,
        fee_plan_id=None,
    )
    db_session.add(batch)
    db_session.flush()

    db_session.add(StudentBatch(institute_id=institute.id, student_id=student.id, batch_id=batch.id))
    db_session.commit()
    return teacher, student, batch


def _teacher_headers(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "teacher@test.com", "password": "Teacher@123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_mark_attendance_and_stats(client, db_session):
    _, student, batch = _seed_attendance_context(db_session)
    headers = _teacher_headers(client)

    mark = client.post(
        "/api/v1/attendance/mark",
        json={
            "batch_id": batch.id,
            "date": date.today().isoformat(),
            "records": [{"student_id": student.id, "status": "PRESENT"}],
        },
        headers=headers,
    )
    assert mark.status_code == 200
    assert mark.json()[0]["status"] == "PRESENT"

    history = client.get(
        "/api/v1/attendance/history",
        params={"batch_id": batch.id},
        headers=headers,
    )
    assert history.status_code == 200
    assert history.json()["total"] == 1

    stats = client.get(
        "/api/v1/attendance/stats",
        params={"batch_id": batch.id, "student_id": student.id},
        headers=headers,
    )
    assert stats.status_code == 200
    assert stats.json()[0]["attendance_percentage"] == 100.0

