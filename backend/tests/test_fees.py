from datetime import date, timedelta

from app.core.security import get_password_hash
from app.models.batch import Batch, StudentBatch
from app.models.enums import StudentStatus, UserRole
from app.models.institute import Institute
from app.models.student import Student
from app.models.user import User


def _seed_fee_context(db_session):
    institute = Institute(name="Fee Institute")
    db_session.add(institute)
    db_session.flush()

    admin = User(
        institute_id=institute.id,
        full_name="Admin",
        email="admin@fees.com",
        phone="9444444444",
        password_hash=get_password_hash("Admin@123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    student = Student(
        institute_id=institute.id,
        full_name="Student Fee",
        phone="9555555555",
        email="student@fees.com",
        guardian_name="Guardian Fee",
        guardian_phone="9666666666",
        address="Address",
        join_date=date.today(),
        status=StudentStatus.ACTIVE,
    )
    db_session.add_all([admin, student])
    db_session.flush()

    batch = Batch(
        institute_id=institute.id,
        name="Batch Fee",
        course="Physics",
        schedule="Tue Thu 8AM",
        teacher_id=None,
        start_date=date.today(),
        end_date=None,
        fee_plan_id=None,
    )
    db_session.add(batch)
    db_session.flush()
    db_session.add(StudentBatch(institute_id=institute.id, student_id=student.id, batch_id=batch.id))
    db_session.commit()
    return student, batch


def _admin_headers(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@fees.com", "password": "Admin@123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_fee_mapping_payment_and_receipt(client, db_session):
    student, batch = _seed_fee_context(db_session)
    headers = _admin_headers(client)

    create_fee = client.post(
        "/api/v1/fees/student-fees",
        json={
            "student_id": student.id,
            "batch_id": batch.id,
            "fee_plan_id": None,
            "total_fee": "6000.00",
            "discount": "500.00",
            "due_schedule": [
                {"due_date": (date.today() - timedelta(days=2)).isoformat(), "amount": "3000.00"},
                {"due_date": (date.today() + timedelta(days=20)).isoformat(), "amount": "3000.00"},
            ],
        },
        headers=headers,
    )
    assert create_fee.status_code == 201
    student_fee_id = create_fee.json()["id"]
    assert create_fee.json()["due_amount"] == "5500.00"

    payment = client.post(
        "/api/v1/fees/payments",
        json={
            "student_fee_id": student_fee_id,
            "amount": "1500.00",
            "paid_on": date.today().isoformat(),
            "mode": "UPI",
            "remarks": "First installment",
        },
        headers=headers,
    )
    assert payment.status_code == 201
    payment_id = payment.json()["id"]

    dues = client.get("/api/v1/fees/dues", headers=headers)
    assert dues.status_code == 200
    assert dues.json()[0]["due_amount"] == "4000.00"

    receipt = client.get(f"/api/v1/fees/payments/{payment_id}/receipt", headers=headers)
    assert receipt.status_code == 200
    assert receipt.headers["content-type"] == "application/pdf"
    assert receipt.content.startswith(b"%PDF")

